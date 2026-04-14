from __future__ import annotations

import argparse
import json
from collections import defaultdict
from functools import lru_cache
from pathlib import Path
from typing import Any

import pandas as pd

from IDrec import SimpleRecommender as ExplainedSimpleRecommender
from matrix_factorization import MatrixFactorizationRecommender
from wizan_api import (
    RATINGS_CSV,
    load_or_train_model,
    infer_user_factor,
    get_top_recommendations,
    select_interview_movies,
)


BASE_DIR = Path(__file__).resolve().parent


def _as_json(payload: dict[str, Any], exit_code: int = 0) -> None:
    print(json.dumps(payload))
    raise SystemExit(exit_code)


@lru_cache(maxsize=1)
def load_simple_model() -> ExplainedSimpleRecommender:
    return ExplainedSimpleRecommender(
        movie_stats_file=str(BASE_DIR / "movie_stats.csv"),
        user_profiles_file=str(BASE_DIR / "user_profiles.csv"),
        data_file=str(BASE_DIR / "movielens_combined.csv"),
    )


@lru_cache(maxsize=1)
def load_mf_model() -> MatrixFactorizationRecommender:
    model = MatrixFactorizationRecommender(
        ratings_csv=str(BASE_DIR / "ratings.csv"),
        items_csv=str(BASE_DIR / "movies.csv"),
        method="svd",
        verbose=False,
    )
    model.load_data()
    model.build_user_item_matrix()
    model.fit()
    return model


@lru_cache(maxsize=1)
def load_movie_metadata() -> dict[int, dict[str, str]]:
    movies = pd.read_csv(BASE_DIR / "movies.csv")
    return {
        int(row.movieId): {
            "title": str(row.title),
            "genres": str(row.genres),
        }
        for row in movies.itertuples(index=False)
    }


def _normalize_simple_recommendations(user_id: int, top_n: int) -> list[dict[str, Any]]:
    model = load_simple_model()
    movie_metadata = load_movie_metadata()
    if user_id not in model.user_profiles:
        return []

    recommendations = []
    for rank, (movie_id, title, score, breakdown) in enumerate(model.recommend(user_id, top_n), start=1):
        top_genre_matches = sorted(
            breakdown["genre_matches"].items(),
            key=lambda item: item[1],
            reverse=True,
        )
        recommendations.append(
            {
                "movie_id": int(movie_id),
                "title": str(title),
                "genres": movie_metadata.get(int(movie_id), {}).get(
                    "genres",
                    "|".join(model.movie_stats[movie_id]["genres_list"]),
                ),
                "score": round(float(score), 4),
                "model": "simple",
                "rank": rank,
                "average_rating": round(float(breakdown["avg_rating"]), 2),
                "support": int(breakdown["rating_count"]),
                "explanation": {
                    "type": "weighted-genre-blend",
                    "rating_contribution": round(float(breakdown["rating_contribution"]), 4),
                    "genre_contribution": round(float(breakdown["genre_contribution"]), 4),
                    "rating_weight": float(breakdown["rating_weight"]),
                    "genre_weight": float(breakdown["genre_weight"]),
                    "top_genre_matches": [
                        {"genre": genre, "value": round(float(value), 4)}
                        for genre, value in top_genre_matches[:4]
                    ],
                },
            }
        )
    return recommendations


def _normalize_mf_recommendations(user_id: int, top_n: int) -> list[dict[str, Any]]:
    model = load_mf_model()
    movie_metadata = load_movie_metadata()
    if user_id not in model.user_item_matrix.index:
        return []

    recommendations = []
    for rank, row in enumerate(model.recommend_records(user_id=user_id, top_n=top_n), start=1):
        recommendations.append(
            {
                "movie_id": int(row["item_id"]),
                "title": row.get("title") or f"Movie {row['item_id']}",
                "genres": movie_metadata.get(int(row["item_id"]), {}).get("genres", ""),
                "score": round(float(row["predicted_rating"]), 4),
                "predicted_rating": round(float(row["predicted_rating"]), 4),
                "model": "mf",
                "rank": rank,
            }
        )
    return recommendations


def _normalize_wizan_recommendations(user_id: int, top_n: int) -> list[dict[str, Any]]:
    factors, item_factors, user_ids, item_ids = load_or_train_model()
    if user_id not in user_ids:
        return []

    user_index = user_ids.index(user_id)
    user_vector = factors[user_index]

    seen = set()
    if RATINGS_CSV.exists():
        import pandas as pd

        ratings = pd.read_csv(RATINGS_CSV).rename(columns={"userId": "user_id", "movieId": "item_id"})
        seen = set(ratings[ratings["user_id"] == user_id]["item_id"].tolist())

    recommendations = []
    for rank, row in enumerate(
        get_top_recommendations(user_vector, item_factors, item_ids, exclude_item_ids=seen, top_n=top_n),
        start=1,
    ):
        recommendations.append(
            {
                "movie_id": int(row["item_id"]),
                "title": row["title"],
                "genres": row.get("genres", ""),
                "score": round(float(row["predicted_rating"]), 4),
                "predicted_rating": round(float(row["predicted_rating"]), 4),
                "model": "wizan",
                "rank": rank,
            }
        )
    return recommendations


def _rank_fusion(recommendations_by_model: dict[str, list[dict[str, Any]]], top_n: int) -> list[dict[str, Any]]:
    fused_scores: dict[int, float] = defaultdict(float)
    titles: dict[int, str] = {}
    genres: dict[int, str] = {}
    model_ranks: dict[int, dict[str, int]] = defaultdict(dict)
    supports: dict[int, int] = defaultdict(int)

    for model_name, recommendations in recommendations_by_model.items():
        for rec in recommendations:
            movie_id = int(rec["movie_id"])
            rank = int(rec["rank"])
            fused_scores[movie_id] += 1.0 / (60 + rank)
            titles[movie_id] = rec["title"]
            genres[movie_id] = rec.get("genres", "")
            model_ranks[movie_id][model_name] = rank
            supports[movie_id] += 1

    ranked = sorted(fused_scores.items(), key=lambda item: item[1], reverse=True)
    return [
        {
            "movie_id": movie_id,
            "title": titles[movie_id],
            "genres": genres.get(movie_id, ""),
            "score": round(score, 6),
            "model": "ensemble",
            "support": supports[movie_id],
            "source_models": sorted(model_ranks[movie_id].keys()),
            "individual_ranks": model_ranks[movie_id],
            "rank": rank,
        }
        for rank, (movie_id, score) in enumerate(ranked[:top_n], start=1)
    ]


def model_recommendations(model: str, user_id: int, top_n: int) -> list[dict[str, Any]]:
    if model == "simple":
        return _normalize_simple_recommendations(user_id, top_n)
    if model == "mf":
        return _normalize_mf_recommendations(user_id, top_n)
    if model == "wizan":
        return _normalize_wizan_recommendations(user_id, top_n)
    if model == "ensemble":
        all_recommendations = {
            "simple": _normalize_simple_recommendations(user_id, top_n * 2),
            "mf": _normalize_mf_recommendations(user_id, top_n * 2),
            "wizan": _normalize_wizan_recommendations(user_id, top_n * 2),
        }
        available = {name: rows for name, rows in all_recommendations.items() if rows}
        return _rank_fusion(available, top_n)
    raise ValueError(f"Unsupported model '{model}'")


def compare_models(user_id: int, top_n: int) -> dict[str, Any]:
    models = {
        "simple": model_recommendations("simple", user_id, top_n),
        "mf": model_recommendations("mf", user_id, top_n),
        "wizan": model_recommendations("wizan", user_id, top_n),
    }
    models["ensemble"] = _rank_fusion({name: rows for name, rows in models.items() if rows}, top_n)

    overlap_counts: dict[int, int] = defaultdict(int)
    titles: dict[int, str] = {}
    for model_name, rows in models.items():
        if model_name == "ensemble":
            continue
        for rec in rows:
            overlap_counts[int(rec["movie_id"])] += 1
            titles[int(rec["movie_id"])] = rec["title"]

    overlap = [
        {"movie_id": movie_id, "title": titles[movie_id], "models": count}
        for movie_id, count in sorted(overlap_counts.items(), key=lambda item: item[1], reverse=True)
        if count > 1
    ]

    return {
        "user_id": user_id,
        "top_n": top_n,
        "models": models,
        "overlap": overlap[:top_n],
    }


def coldstart_recommendations(ratings: dict[str, Any], top_n: int) -> list[dict[str, Any]]:
    factors, item_factors, _, item_ids = load_or_train_model()
    item_id_set = set(item_ids)
    item_index = {item_id: idx for idx, item_id in enumerate(item_ids)}

    liked_local = [
        item_index[int(movie_id)]
        for movie_id, rating in ratings.items()
        if int(movie_id) in item_id_set and float(rating) >= 4.0
    ]
    new_user_vector = infer_user_factor(item_factors, liked_local)
    excluded = {int(movie_id) for movie_id in ratings}

    recommendations = []
    for rank, row in enumerate(
        get_top_recommendations(new_user_vector, item_factors, item_ids, exclude_item_ids=excluded, top_n=top_n),
        start=1,
    ):
        recommendations.append(
            {
                "movie_id": int(row["item_id"]),
                "title": row["title"],
                "genres": row.get("genres", ""),
                "score": round(float(row["predicted_rating"]), 4),
                "predicted_rating": round(float(row["predicted_rating"]), 4),
                "model": "wizan-coldstart",
                "rank": rank,
            }
        )
    return recommendations


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="JSON bridge for recommendation models")
    parser.add_argument("mode", choices=["model", "compare", "interview", "coldstart"])
    parser.add_argument("--model", choices=["simple", "mf", "wizan", "ensemble"], default="simple")
    parser.add_argument("--user-id", type=int, default=None)
    parser.add_argument("--top-n", type=int, default=10)
    parser.add_argument("--count", type=int, default=12)
    parser.add_argument("--ratings", type=str, default="{}")
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    try:
        if args.mode == "interview":
            _as_json({"interview_movies": select_interview_movies(args.count)})

        if args.mode == "coldstart":
            ratings = json.loads(args.ratings)
            _as_json(
                {
                    "method": "wizan-coldstart",
                    "recommendations": coldstart_recommendations(ratings, args.top_n),
                }
            )

        if args.user_id is None:
            _as_json({"code": "MISSING_USER", "message": "A user ID is required for this mode."}, exit_code=1)

        if args.mode == "model":
            _as_json(
                {
                    "user_id": args.user_id,
                    "model": args.model,
                    "recommendations": model_recommendations(args.model, args.user_id, args.top_n),
                }
            )

        if args.mode == "compare":
            _as_json(compare_models(args.user_id, args.top_n))

    except Exception as error:
        _as_json(
            {
                "code": "BRIDGE_ERROR",
                "message": str(error),
            },
            exit_code=1,
        )


if __name__ == "__main__":
    main()
