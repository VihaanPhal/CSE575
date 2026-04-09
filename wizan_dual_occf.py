"""
wiZAN-Dual: One-Class Collaborative Filtering on MovieLens data.

Paper: "Dual-Regularized One-Class Collaborative Filtering" (Yao et al., CIKM 2014)

Mapping MovieLens CSVs to the paper:
  - ratings.csv  -> one-class feedback matrix R  (rating >= 4 => 1, else unobserved)
  - movies.csv   -> item-item graph N             (cosine similarity of genre binary vectors)
  - tags.csv     -> item-item graph N (optional)  (tag co-occurrence similarity)
  - No explicit user-trust graph in MovieLens, so user-user graph M is built
    from rating co-occurrence / Jaccard similarity between user rating sets.

Evaluation metrics (as in the paper):
  - HLU  : Half-Life Utility  (larger is better)
  - MAP  : Mean Average Precision (larger is better)
  - MPR  : Mean Percentage Ranking (smaller is better; random = 50%)

Algorithm: wiZAN-Dual (Algorithm 1 in the paper)
  F(u,k) <- F(u,k) * sqrt(A1(u,k) / B1(u,k))
  G(i,k) <- G(i,k) * sqrt(A2(i,k) / B2(i,k))
  where A1, B1, A2, B2 are defined in Eq. (12) and (14).
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MultiLabelBinarizer


# ---------------------------------------------------------------------------
# Data loading helpers
# ---------------------------------------------------------------------------

def load_one_class_matrix(ratings_csv: str, threshold: float = 4.0):
    """
    Load ratings and binarise: rating >= threshold -> 1, else unobserved (0).
    Returns:
        R_sparse : scipy csr_matrix (m x n), binary
        user_ids : list of original user IDs
        item_ids : list of original item IDs
    """
    df = pd.read_csv(ratings_csv)
    df = df.rename(columns={"userId": "user_id", "movieId": "item_id"})

    # Keep only positive examples
    pos_df = df[df["rating"] >= threshold][["user_id", "item_id"]].drop_duplicates()

    user_ids = sorted(pos_df["user_id"].unique().tolist())
    item_ids = sorted(pos_df["item_id"].unique().tolist())

    user_idx = {u: i for i, u in enumerate(user_ids)}
    item_idx = {it: i for i, it in enumerate(item_ids)}

    rows = [user_idx[u] for u in pos_df["user_id"]]
    cols = [item_idx[it] for it in pos_df["item_id"]]
    data = np.ones(len(rows), dtype=np.float32)

    m, n = len(user_ids), len(item_ids)
    R = csr_matrix((data, (rows, cols)), shape=(m, n))

    print(f"[Data] Users: {m}, Items: {n}, Positive examples: {R.nnz}")
    print(f"[Data] Sparsity of positive examples: {R.nnz / (m * n) * 100:.3f}%")
    return R, user_ids, item_ids


def build_item_item_graph(movies_csv: str, item_ids: list, sim_threshold: float = 0.4):
    """
    Build item-item graph N from genre binary vectors (cosine similarity).
    N[i,j] = 1 if cosine_sim(genres_i, genres_j) > sim_threshold, else 0.
    Only considers items present in item_ids.
    """
    movies = pd.read_csv(movies_csv)
    movies = movies.rename(columns={"movieId": "item_id"})
    movies = movies[movies["item_id"].isin(item_ids)].copy()
    movies["genres_list"] = movies["genres"].apply(lambda g: g.split("|") if isinstance(g, str) else [])

    item_idx = {it: i for i, it in enumerate(item_ids)}

    mlb = MultiLabelBinarizer()
    genre_matrix = mlb.fit_transform(movies["genres_list"])

    # Map back to our item ordering
    n = len(item_ids)
    full_genre_matrix = np.zeros((n, genre_matrix.shape[1]), dtype=np.float32)
    for local_i, item_id in enumerate(movies["item_id"]):
        if item_id in item_idx:
            full_genre_matrix[item_idx[item_id]] = genre_matrix[local_i]

    sim = cosine_similarity(full_genre_matrix)
    N = (sim > sim_threshold).astype(np.float32)
    np.fill_diagonal(N, 0.0)  # no self-loops

    print(f"[Graph] Item-item graph: {int(N.sum())} links (threshold={sim_threshold})")
    return N


def build_user_user_graph(R: csr_matrix, jaccard_threshold: float = 0.1, max_users: int = 2000):
    """
    Build user-user graph M via Jaccard similarity of rated item sets.
    For efficiency, only uses the first max_users users.
    Paper uses trust relationships; we approximate with rating-set Jaccard.
    """
    m = R.shape[0]
    use_m = min(m, max_users)
    R_sub = R[:use_m]

    # Jaccard via dot products: |A ∩ B| / |A ∪ B|
    R_bin = (R_sub > 0).astype(np.float32)
    intersection = R_bin.dot(R_bin.T).toarray()
    row_sums = np.array(R_bin.sum(axis=1)).flatten()
    union = row_sums[:, None] + row_sums[None, :] - intersection
    with np.errstate(divide="ignore", invalid="ignore"):
        jaccard = np.where(union > 0, intersection / union, 0.0)

    M_sub = (jaccard > jaccard_threshold).astype(np.float32)
    np.fill_diagonal(M_sub, 0.0)

    # Pad to full m x m if needed
    if use_m < m:
        M = np.zeros((m, m), dtype=np.float32)
        M[:use_m, :use_m] = M_sub
    else:
        M = M_sub

    print(f"[Graph] User-user graph: {int(M.sum())} links (Jaccard>{jaccard_threshold}, {use_m} users)")
    return M


# ---------------------------------------------------------------------------
# Train/test split
# ---------------------------------------------------------------------------

def train_test_split_one_class(R: csr_matrix, test_ratio: float = 0.5, seed: int = 42):
    """
    Randomly hold out test_ratio of positive examples as the test set.
    Returns R_train (csr), and (test_users, test_items) arrays.
    """
    rng = np.random.default_rng(seed)
    rows, cols = R.nonzero()
    n_pos = len(rows)
    idx = rng.permutation(n_pos)
    split = int(n_pos * (1 - test_ratio))

    train_rows = rows[idx[:split]]
    train_cols = cols[idx[:split]]
    test_rows  = rows[idx[split:]]
    test_cols  = cols[idx[split:]]

    m, n = R.shape
    R_train = csr_matrix(
        (np.ones(split, dtype=np.float32), (train_rows, train_cols)), shape=(m, n)
    )
    return R_train, test_rows, test_cols


# ---------------------------------------------------------------------------
# wiZAN-Dual algorithm
# ---------------------------------------------------------------------------

def compute_R1_tilde(F: np.ndarray, G: np.ndarray, R_train: csr_matrix) -> csr_matrix:
    """
    R̃1(u,i) = F(u,:)·G(i,:)' if (u,i) in O, else 0  (Eq. 10 in paper).
    """
    rows, cols = R_train.nonzero()
    vals = np.einsum("ij,ij->i", F[rows], G[cols]).astype(np.float32)
    return csr_matrix((vals, (rows, cols)), shape=R_train.shape)


def wizam_dual_fit(
    R_train: csr_matrix,
    M: np.ndarray,
    N: np.ndarray,
    rank: int = 10,
    w: float = 0.01,       # global weight (√w in paper, so actual weight = w^0.5)
    p: float = 0.01,       # global imputation value
    lambda_r: float = 0.1, # regularization for ||F||^2 + ||G||^2
    lambda_F: float = 1.0, # user graph regularization
    lambda_G: float = 0.1, # item graph regularization
    max_iter: int = 100,
    tol: float = 1e-6,
    seed: int = 42,
    verbose: bool = True,
) -> tuple[np.ndarray, np.ndarray]:
    """
    Algorithm 1: wiZAN-Dual

    Updates:
      F(u,k) <- F(u,k) * sqrt(A1(u,k) / B1(u,k))
      G(i,k) <- G(i,k) * sqrt(A2(i,k) / B2(i,k))

    A1 = (1 - w*p)*R*G  +  w*p*1_{m×1}*(1_{1×n}*G)  +  λ_F * M * F
    B1 = (1 - w)*R̃1*G  +  w*F*(G'G)  +  λ_r*F  +  λ_F * D_M * F

    A2 = (1 - w*p)*R'*F  +  w*p*1_{n×1}*(1_{1×m}*F)  +  λ_G * N * G
    B2 = (1 - w)*R̃1'*F  +  w*G*(F'F)  +  λ_r*G  +  λ_G * D_N * G
    """
    rng = np.random.default_rng(seed)
    m, n = R_train.shape

    # Step 1: random non-negative initialisation
    F = np.abs(rng.standard_normal((m, rank)).astype(np.float32)) * 0.1 + 0.01
    G = np.abs(rng.standard_normal((n, rank)).astype(np.float32)) * 0.1 + 0.01

    # Degree matrices for graph Laplacians
    D_M = np.diag(M.sum(axis=1)).astype(np.float32)  # m×m diagonal
    D_N = np.diag(N.sum(axis=1)).astype(np.float32)  # n×n diagonal

    # Precompute R (used repeatedly)
    R_dense = R_train.toarray().astype(np.float32)  # m×n, binary
    ones_n = np.ones((1, n), dtype=np.float32)      # 1×n
    ones_m = np.ones((1, m), dtype=np.float32)      # 1×m

    eps = 1e-10  # numerical stability

    for it in range(1, max_iter + 1):
        # ----- Update F -----
        R1 = compute_R1_tilde(F, G, R_train)
        R1_dense = R1.toarray().astype(np.float32)

        GtG = G.T @ G                                   # r×r
        sum_G = ones_n @ G                               # 1×r

        A1 = (1 - w * p) * (R_dense @ G) + w * p * np.ones((m, 1)) @ sum_G + lambda_F * (M @ F)
        B1 = (1 - w) * (R1_dense @ G) + w * (F @ GtG) + lambda_r * F + lambda_F * (D_M @ F)

        A1 = np.maximum(A1, eps)
        B1 = np.maximum(B1, eps)
        F_new = F * np.sqrt(A1 / B1)
        F_new = np.maximum(F_new, eps)

        # ----- Update G -----
        R1 = compute_R1_tilde(F_new, G, R_train)
        R1_dense = R1.toarray().astype(np.float32)

        FtF = F_new.T @ F_new                           # r×r
        sum_F = ones_m @ F_new                           # 1×r

        A2 = (1 - w * p) * (R_dense.T @ F_new) + w * p * np.ones((n, 1)) @ sum_F + lambda_G * (N @ G)
        B2 = (1 - w) * (R1_dense.T @ F_new) + w * (G @ FtF) + lambda_r * G + lambda_G * (D_N @ G)

        A2 = np.maximum(A2, eps)
        B2 = np.maximum(B2, eps)
        G_new = G * np.sqrt(A2 / B2)
        G_new = np.maximum(G_new, eps)

        # Convergence check
        delta_F = np.linalg.norm(F_new - F, "fro")
        delta_G = np.linalg.norm(G_new - G, "fro")

        F, G = F_new, G_new

        if verbose and (it % 10 == 0 or it == 1):
            print(f"  iter {it:>4}/{max_iter}  dF={delta_F:.6f}  dG={delta_G:.6f}")

        if delta_F < tol and delta_G < tol:
            if verbose:
                print(f"  Converged at iter {it}")
            break

    return F, G


# ---------------------------------------------------------------------------
# Evaluation metrics
# ---------------------------------------------------------------------------

def compute_metrics(
    F: np.ndarray,
    G: np.ndarray,
    R_train: csr_matrix,
    test_rows: np.ndarray,
    test_cols: np.ndarray,
    half_life: float = 5.0,
    n_sample_users: int | None = None,
    seed: int = 42,
) -> dict:
    """
    Compute HLU, MAP, MPR as defined in the paper.

    For each user in the test set:
      - Predict scores for all unseen items (not in training set)
      - Rank items by predicted score
      - Compute the metric contribution for test-positive items

    HLU  = Σ_u Σ_i [R_test(u,i) / max(1, 2^((rank(u,i)-1)/(half_life-1)))]
           normalised by Σ_u Σ_i [1 / max(1, 2^((i-1)/(half_life-1)))] over ideal ranking
    MAP  = mean over users of AP(u)
    MPR  = mean over users of mean-percentile-rank of test positives
    """
    m, n = R_train.shape

    # Group test positives by user
    from collections import defaultdict
    user_test_items: dict[int, list[int]] = defaultdict(list)
    for u, i in zip(test_rows, test_cols):
        user_test_items[int(u)].append(int(i))

    test_users = list(user_test_items.keys())
    if n_sample_users is not None and n_sample_users < len(test_users):
        rng = np.random.default_rng(seed)
        test_users = rng.choice(test_users, size=n_sample_users, replace=False).tolist()

    # Precompute full predicted matrix for sampled users
    R_hat = F[test_users] @ G.T  # (#test_users x n)

    train_dok = set(zip(*R_train.nonzero()))

    hlu_list, map_list, mpr_list = [], [], []

    for local_u, u in enumerate(test_users):
        test_pos = set(user_test_items[u])
        if not test_pos:
            continue

        scores = R_hat[local_u].copy()

        # Mask training items so we rank only unseen items
        for i in range(n):
            if (u, i) in train_dok:
                scores[i] = -np.inf

        order = np.argsort(-scores)  # descending
        rank_of = {int(item): int(rank + 1) for rank, item in enumerate(order) if scores[item] > -np.inf}

        # ---- MPR ----
        pct_ranks = [rank_of[i] / len(rank_of) * 100 for i in test_pos if i in rank_of]
        if pct_ranks:
            mpr_list.append(np.mean(pct_ranks))

        # ---- MAP ----
        hits, ap = 0, 0.0
        for rank_1based, item in enumerate(order, start=1):
            if scores[item] == -np.inf:
                break
            if item in test_pos:
                hits += 1
                ap += hits / rank_1based
        if hits:
            map_list.append(ap / len(test_pos))
        else:
            map_list.append(0.0)

        # ---- HLU ----
        hlu_u = 0.0
        for i in test_pos:
            if i in rank_of:
                r = rank_of[i]
                exp_val = (r - 1) / (half_life - 1)
                if exp_val > 100:
                    continue  # 2^exp_val >> 1, contribution ~0
                hlu_u += 1.0 / max(1.0, 2.0 ** exp_val)
        hlu_list.append(hlu_u)

    results = {
        "HLU": float(np.mean(hlu_list)) if hlu_list else 0.0,
        "MAP": float(np.mean(map_list)) if map_list else 0.0,
        "MPR": float(np.mean(mpr_list)) / 100.0 if mpr_list else 0.5,
        "n_users_evaluated": len(hlu_list),
    }
    return results


# ---------------------------------------------------------------------------
# Baseline: wZAN (weighting-only, no imputation, no graph regularisation)
# ---------------------------------------------------------------------------

def wzan_fit(
    R_train: csr_matrix,
    rank: int = 10,
    w: float = 0.01,
    lambda_r: float = 0.1,
    max_iter: int = 100,
    tol: float = 1e-6,
    seed: int = 42,
    verbose: bool = False,
) -> tuple[np.ndarray, np.ndarray]:
    """Weighting-based baseline (Eq. 1 in the paper, uniform strategy)."""
    M_zero = np.zeros((R_train.shape[0], R_train.shape[0]), dtype=np.float32)
    N_zero = np.zeros((R_train.shape[1], R_train.shape[1]), dtype=np.float32)
    return wizam_dual_fit(
        R_train, M_zero, N_zero,
        rank=rank, w=w, p=0.0,
        lambda_r=lambda_r, lambda_F=0.0, lambda_G=0.0,
        max_iter=max_iter, tol=tol, seed=seed, verbose=verbose,
    )


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def parse_args():
    p = argparse.ArgumentParser(description="wiZAN-Dual OCCF on MovieLens data")
    default_dir = Path(__file__).resolve().parent
    p.add_argument("--ratings-csv", default=str(default_dir / "ratings.csv"))
    p.add_argument("--movies-csv",  default=str(default_dir / "movies.csv"))
    p.add_argument("--rank",        type=int,   default=10)
    p.add_argument("--w",           type=float, default=0.01,  help="global weight √w (paper uses 0.1²=0.01)")
    p.add_argument("--p",           type=float, default=0.01,  help="global imputation value")
    p.add_argument("--lambda-r",    type=float, default=0.1)
    p.add_argument("--lambda-F",    type=float, default=1.0)
    p.add_argument("--lambda-G",    type=float, default=0.1)
    p.add_argument("--max-iter",    type=int,   default=100)
    p.add_argument("--test-ratio",  type=float, default=0.5,   help="paper uses 50% test split")
    p.add_argument("--item-sim-threshold", type=float, default=0.4)
    p.add_argument("--user-jac-threshold", type=float, default=0.05)
    p.add_argument("--eval-users",  type=int,   default=200,   help="users to sample for evaluation speed")
    p.add_argument("--run-baseline", action="store_true", help="also run wZAN baseline for comparison")
    p.add_argument("--show-users",  type=int, default=5,   help="how many users to show recommendations for")
    return p.parse_args()


def main():
    args = parse_args()

    print("=" * 60)
    print("wiZAN-Dual: One-Class Collaborative Filtering")
    print("Paper: Yao et al., CIKM 2014")
    print("=" * 60)

    # ------------------------------------------------------------------
    # 1. Load data
    # ------------------------------------------------------------------
    print("\n[1] Loading data ...")
    R, user_ids, item_ids = load_one_class_matrix(args.ratings_csv, threshold=4.0)

    # ------------------------------------------------------------------
    # 2. Build side-information graphs
    # ------------------------------------------------------------------
    print("\n[2] Building side-information graphs ...")
    N = build_item_item_graph(args.movies_csv, item_ids, sim_threshold=args.item_sim_threshold)
    M = build_user_user_graph(R, jaccard_threshold=args.user_jac_threshold)

    # ------------------------------------------------------------------
    # 3. Train/test split (50% as in the paper)
    # ------------------------------------------------------------------
    print(f"\n[3] Splitting data (test ratio={args.test_ratio}) ...")
    R_train, test_rows, test_cols = train_test_split_one_class(R, test_ratio=args.test_ratio)
    print(f"    Train positives: {R_train.nnz}  |  Test positives: {len(test_rows)}")

    # ------------------------------------------------------------------
    # 4. Optional baseline: wZAN
    # ------------------------------------------------------------------
    if args.run_baseline:
        print("\n[4a] Running wZAN baseline ...")
        t0 = time.time()
        F_wzan, G_wzan = wzan_fit(
            R_train, rank=args.rank, w=args.w,
            lambda_r=args.lambda_r, max_iter=args.max_iter, verbose=False
        )
        print(f"    wZAN training time: {time.time()-t0:.1f}s")
        metrics_wzan = compute_metrics(
            F_wzan, G_wzan, R_train, test_rows, test_cols,
            n_sample_users=args.eval_users
        )
        print(f"    wZAN   -> HLU={metrics_wzan['HLU']:.4f}  MAP={metrics_wzan['MAP']:.4f}  MPR={metrics_wzan['MPR']:.4f}")

    # ------------------------------------------------------------------
    # 5. wiZAN-Dual
    # ------------------------------------------------------------------
    print("\n[4] Running wiZAN-Dual ...")
    print(f"    rank={args.rank}  w={args.w}  p={args.p}  "
          f"lr={args.lambda_r}  lF={args.lambda_F}  lG={args.lambda_G}  "
          f"max_iter={args.max_iter}")
    t0 = time.time()
    F, G = wizam_dual_fit(
        R_train, M, N,
        rank=args.rank,
        w=args.w,
        p=args.p,
        lambda_r=args.lambda_r,
        lambda_F=args.lambda_F,
        lambda_G=args.lambda_G,
        max_iter=args.max_iter,
        verbose=True,
    )
    elapsed = time.time() - t0
    print(f"    Training time: {elapsed:.1f}s")

    # ------------------------------------------------------------------
    # 6. Evaluate
    # ------------------------------------------------------------------
    print(f"\n[5] Evaluating on {args.eval_users} sampled users ...")
    metrics = compute_metrics(
        F, G, R_train, test_rows, test_cols,
        n_sample_users=args.eval_users,
    )

    print("\n" + "=" * 60)
    print("Results (wiZAN-Dual on MovieLens-small):")
    print(f"  HLU : {metrics['HLU']:.4f}  (larger is better)")
    print(f"  MAP : {metrics['MAP']:.4f}  (larger is better)")
    print(f"  MPR : {metrics['MPR']:.4f}  (smaller is better; random=0.50)")
    print(f"  Users evaluated: {metrics['n_users_evaluated']}")
    print("=" * 60)

    # ------------------------------------------------------------------
    # 7. Sample recommendations for a random user
    # ------------------------------------------------------------------
    try:
        movies_df = pd.read_csv(args.movies_csv).rename(columns={"movieId": "item_id"})
        item_id_to_title = dict(zip(movies_df["item_id"], movies_df["title"]))
    except Exception:
        item_id_to_title = {}

    # Show recommendations for multiple sample users (most active ones)
    ratings_df = pd.read_csv(args.ratings_csv).rename(columns={"userId": "user_id", "movieId": "item_id"})
    top_users = ratings_df["user_id"].value_counts().head(args.show_users).index.tolist()
    # Filter to users that exist in our model
    top_users = [u for u in top_users if u in user_ids][:args.show_users]

    for sample_uid in top_users:
        sample_user_local = user_ids.index(sample_uid)
        scores = F[sample_user_local] @ G.T
        train_items = set(R_train[sample_user_local].indices)
        masked = [(i, float(scores[i])) for i in range(len(item_ids)) if i not in train_items]
        masked.sort(key=lambda x: -x[1])
        print(f"\nTop-10 recommendations for user {sample_uid}:")
        for rank_1, (item_local, score) in enumerate(masked[:10], start=1):
            real_item_id = item_ids[item_local]
            title = item_id_to_title.get(real_item_id, f"item_{real_item_id}")
            print(f"  {rank_1:>2}. {title:<50s}  score={score:.4f}")


if __name__ == "__main__":
    main()
