"""
wiZAN-Dual API script — called by Next.js via execFile.

Modes (set via --mode):
  existing   --user-id <id>              recommend for an existing user
  interview  --count <n>                 return diverse movies for a new user to rate
  coldstart  --ratings '{"1":4,"2":5}'   infer new user factor + recommend

Model is trained once and cached to wizan_model_cache.npz.
All output is JSON on stdout.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MultiLabelBinarizer

DATA_DIR   = Path(__file__).resolve().parent
CACHE_FILE = DATA_DIR / "wizan_model_cache.npz"
RATINGS_CSV = DATA_DIR / "ratings.csv"
MOVIES_CSV  = DATA_DIR / "movies.csv"

# ──────────────────────────────────────────────
# Data helpers (same logic as wizan_dual_occf.py)
# ──────────────────────────────────────────────

def load_one_class(threshold: float = 4.0):
    df = pd.read_csv(RATINGS_CSV).rename(columns={"userId": "user_id", "movieId": "item_id"})
    pos = df[df["rating"] >= threshold][["user_id", "item_id"]].drop_duplicates()
    user_ids = sorted(pos["user_id"].unique().tolist())
    item_ids = sorted(pos["item_id"].unique().tolist())
    uidx = {u: i for i, u in enumerate(user_ids)}
    iidx = {it: i for i, it in enumerate(item_ids)}
    rows = [uidx[u] for u in pos["user_id"]]
    cols = [iidx[it] for it in pos["item_id"]]
    R = csr_matrix((np.ones(len(rows), np.float32), (rows, cols)),
                   shape=(len(user_ids), len(item_ids)))
    return R, user_ids, item_ids


def build_item_graph(item_ids: list, sim_threshold: float = 0.4):
    movies = pd.read_csv(MOVIES_CSV).rename(columns={"movieId": "item_id"})
    movies = movies[movies["item_id"].isin(item_ids)].copy()
    movies["gl"] = movies["genres"].apply(lambda g: g.split("|") if isinstance(g, str) else [])
    mlb = MultiLabelBinarizer()
    gm = mlb.fit_transform(movies["gl"])
    iidx = {it: i for i, it in enumerate(item_ids)}
    n = len(item_ids)
    full = np.zeros((n, gm.shape[1]), np.float32)
    for li, iid in enumerate(movies["item_id"]):
        if iid in iidx:
            full[iidx[iid]] = gm[li]
    sim = cosine_similarity(full)
    N = (sim > sim_threshold).astype(np.float32)
    np.fill_diagonal(N, 0.0)
    return N


def build_user_graph(R: csr_matrix, jac_threshold: float = 0.05):
    R_bin = (R > 0).astype(np.float32)
    inter = R_bin.dot(R_bin.T).toarray()
    rs = np.array(R_bin.sum(axis=1)).flatten()
    union = rs[:, None] + rs[None, :] - inter
    with np.errstate(divide="ignore", invalid="ignore"):
        jac = np.where(union > 0, inter / union, 0.0)
    M = (jac > jac_threshold).astype(np.float32)
    np.fill_diagonal(M, 0.0)
    return M


# ──────────────────────────────────────────────
# wiZAN-Dual training (Algorithm 1 from paper)
# ──────────────────────────────────────────────

def _R1_tilde(F, G, R):
    rows, cols = R.nonzero()
    vals = np.einsum("ij,ij->i", F[rows], G[cols]).astype(np.float32)
    return csr_matrix((vals, (rows, cols)), shape=R.shape)


def wizan_dual_fit(R, M, N, rank=10, w=0.01, p=0.01,
                   lambda_r=0.1, lambda_F=1.0, lambda_G=0.1,
                   max_iter=100, tol=1e-6, seed=42):
    rng = np.random.default_rng(seed)
    m, n = R.shape
    F = np.abs(rng.standard_normal((m, rank)).astype(np.float32)) * 0.1 + 0.01
    G = np.abs(rng.standard_normal((n, rank)).astype(np.float32)) * 0.1 + 0.01
    D_M = np.diag(M.sum(axis=1)).astype(np.float32)
    D_N = np.diag(N.sum(axis=1)).astype(np.float32)
    R_d = R.toarray().astype(np.float32)
    ones_n = np.ones((1, n), np.float32)
    ones_m = np.ones((1, m), np.float32)
    eps = 1e-10

    for _ in range(max_iter):
        R1 = _R1_tilde(F, G, R).toarray().astype(np.float32)
        GtG = G.T @ G
        A1 = (1 - w*p)*(R_d @ G) + w*p*np.ones((m,1))@(ones_n@G) + lambda_F*(M@F)
        B1 = (1 - w)*(R1@G) + w*(F@GtG) + lambda_r*F + lambda_F*(D_M@F)
        F_new = F * np.sqrt(np.maximum(A1, eps) / np.maximum(B1, eps))
        F_new = np.maximum(F_new, eps)

        R1 = _R1_tilde(F_new, G, R).toarray().astype(np.float32)
        FtF = F_new.T @ F_new
        A2 = (1 - w*p)*(R_d.T@F_new) + w*p*np.ones((n,1))@(ones_m@F_new) + lambda_G*(N@G)
        B2 = (1 - w)*(R1.T@F_new) + w*(G@FtF) + lambda_r*G + lambda_G*(D_N@G)
        G_new = G * np.sqrt(np.maximum(A2, eps) / np.maximum(B2, eps))
        G_new = np.maximum(G_new, eps)

        if np.linalg.norm(F_new-F,"fro") < tol and np.linalg.norm(G_new-G,"fro") < tol:
            F, G = F_new, G_new
            break
        F, G = F_new, G_new

    return F, G


# ──────────────────────────────────────────────
# Model cache
# ──────────────────────────────────────────────

def load_or_train_model():
    """Load cached model or train from scratch and cache it."""
    if CACHE_FILE.exists():
        data = np.load(CACHE_FILE, allow_pickle=True)
        F = data["F"]
        G = data["G"]
        user_ids = data["user_ids"].tolist()
        item_ids = data["item_ids"].tolist()
        return F, G, user_ids, item_ids

    R, user_ids, item_ids = load_one_class()
    N = build_item_graph(item_ids)
    M = build_user_graph(R)
    F, G = wizan_dual_fit(R, M, N)

    np.savez(
        CACHE_FILE,
        F=F, G=G,
        user_ids=np.array(user_ids),
        item_ids=np.array(item_ids),
    )
    return F, G, user_ids, item_ids


# ──────────────────────────────────────────────
# Cold-start inference: fold new user into G
# ──────────────────────────────────────────────

def infer_user_factor(G: np.ndarray, liked_item_indices: list[int], lambda_r: float = 0.1):
    """
    Given trained G (n x r) and the local indices of items the new user liked,
    solve: f* = argmin_f ||1 - f·G_obs'||^2 + lambda_r*||f||^2
    Closed form: f* = (G_obs'·G_obs + lambda_r·I)^{-1} · G_obs'·1
    """
    if not liked_item_indices:
        # No positive feedback — return average of all item factors
        return G.mean(axis=0)

    G_obs = G[liked_item_indices]            # k × r
    r_obs = np.ones(len(liked_item_indices), np.float32)
    A = G_obs.T @ G_obs + lambda_r * np.eye(G.shape[1], dtype=np.float32)
    b = G_obs.T @ r_obs
    f = np.linalg.solve(A, b)
    return np.maximum(f, 1e-10)


# ──────────────────────────────────────────────
# Interview movie selection
# ──────────────────────────────────────────────

def select_interview_movies(count: int = 10):
    """
    Pick diverse, popular movies for a new user to rate.
    Strategy: most-rated movies, one per genre cluster to maximise diversity.
    """
    movies = pd.read_csv(MOVIES_CSV).rename(columns={"movieId": "item_id"})
    ratings = pd.read_csv(RATINGS_CSV).rename(columns={"movieId": "item_id"})

    # Count ratings per movie
    pop = ratings.groupby("item_id").size().reset_index(name="n_ratings")
    movies = movies.merge(pop, on="item_id", how="left").fillna({"n_ratings": 0})
    movies = movies.sort_values("n_ratings", ascending=False)

    # Greedy genre-diverse selection
    covered_genres: set[str] = set()
    selected = []
    for _, row in movies.iterrows():
        genres = set(row["genres"].split("|")) if isinstance(row["genres"], str) else set()
        new_genres = genres - covered_genres
        if new_genres or len(selected) < count:
            selected.append({
                "movieId": int(row["item_id"]),
                "title":   str(row["title"]),
                "genres":  str(row["genres"]),
                "nRatings": int(row["n_ratings"]),
            })
            covered_genres |= genres
        if len(selected) >= count:
            break

    # If we still need more, fill with most popular remaining
    if len(selected) < count:
        remaining = movies[~movies["item_id"].isin({s["movieId"] for s in selected})]
        for _, row in remaining.head(count - len(selected)).iterrows():
            selected.append({
                "movieId":  int(row["item_id"]),
                "title":    str(row["title"]),
                "genres":   str(row["genres"]),
                "nRatings": int(row["n_ratings"]),
            })

    return selected


# ──────────────────────────────────────────────
# Recommendation helper
# ──────────────────────────────────────────────

def get_top_recommendations(f_vec, G, item_ids, exclude_item_ids: set, top_n: int = 10):
    movies_df = pd.read_csv(MOVIES_CSV).rename(columns={"movieId": "item_id"})
    id_to_title = dict(zip(movies_df["item_id"], movies_df["title"]))
    id_to_genres = dict(zip(movies_df["item_id"], movies_df["genres"]))

    scores = f_vec @ G.T
    ranked = sorted(
        ((i, float(scores[i])) for i in range(len(item_ids))
         if item_ids[i] not in exclude_item_ids),
        key=lambda x: -x[1]
    )
    return [
        {
            "item_id":         item_ids[i],
            "title":           id_to_title.get(item_ids[i], f"movie_{item_ids[i]}"),
            "genres":          id_to_genres.get(item_ids[i], ""),
            "predicted_rating": round(score, 4),
        }
        for i, score in ranked[:top_n]
    ]


# ──────────────────────────────────────────────
# Modes
# ──────────────────────────────────────────────

def mode_existing(user_id: int, top_n: int):
    F, G, user_ids, item_ids = load_or_train_model()

    if user_id not in user_ids:
        print(json.dumps({"error": f"User {user_id} not found in training data."}))
        return

    u_idx = user_ids.index(user_id)
    f_vec = F[u_idx]

    # Load raw ratings to exclude already-seen items
    df = pd.read_csv(RATINGS_CSV).rename(columns={"userId": "user_id", "movieId": "item_id"})
    seen = set(df[df["user_id"] == user_id]["item_id"].tolist())

    recs = get_top_recommendations(f_vec, G, item_ids, exclude_item_ids=seen, top_n=top_n)
    print(json.dumps({"userId": user_id, "method": "wizan-dual", "recommendations": recs}))


def mode_interview(count: int):
    movies = select_interview_movies(count)
    print(json.dumps({"interviewMovies": movies}))


def mode_coldstart(ratings_json: str, top_n: int):
    """
    ratings_json: '{"1": 4, "2": 5, "318": 2}'  (movieId -> raw rating)
    Items rated >= 4 are treated as positive.
    """
    try:
        raw_ratings: dict[str, float] = json.loads(ratings_json)
    except json.JSONDecodeError as e:
        print(json.dumps({"error": f"Invalid ratings JSON: {e}"}))
        return

    F, G, user_ids, item_ids = load_or_train_model()
    item_id_set = set(item_ids)
    iidx = {it: i for i, it in enumerate(item_ids)}

    # Items rated positively (>= 4) that exist in our item set
    liked_local = [
        iidx[int(mid)]
        for mid, rating in raw_ratings.items()
        if int(mid) in item_id_set and float(rating) >= 4.0
    ]

    f_new = infer_user_factor(G, liked_local)
    excluded = {int(mid) for mid in raw_ratings}  # exclude all rated items from recommendations
    recs = get_top_recommendations(f_new, G, item_ids, exclude_item_ids=excluded, top_n=top_n)
    print(json.dumps({"method": "wizan-dual-coldstart", "recommendations": recs}))


# ──────────────────────────────────────────────
# Entry point
# ──────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode",     required=True, choices=["existing", "interview", "coldstart"])
    parser.add_argument("--user-id",  type=int, default=None)
    parser.add_argument("--top-n",    type=int, default=10)
    parser.add_argument("--count",    type=int, default=10)
    parser.add_argument("--ratings",  type=str, default="{}")
    args = parser.parse_args()

    if args.mode == "existing":
        if args.user_id is None:
            print(json.dumps({"error": "--user-id is required for mode=existing"}))
            sys.exit(1)
        mode_existing(args.user_id, args.top_n)

    elif args.mode == "interview":
        mode_interview(args.count)

    elif args.mode == "coldstart":
        mode_coldstart(args.ratings, args.top_n)


if __name__ == "__main__":
    main()
