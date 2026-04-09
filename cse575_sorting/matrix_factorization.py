"""
Simple Matrix Factorization Recommender (SVD or Gradient Descent) using raw CSV files.

Expected ratings CSV columns (either style works):
- user_id, item_id, rating
- userId, movieId, rating

Optional items CSV columns (either style works):
- item_id, title
- movieId, title

This script:
1. Loads CSV files with pandas
2. Builds a user-item matrix
3. Handles missing values (kept as NaN for masking, filled with 0 for SVD)
4. Applies matrix factorization via:
    - Truncated SVD using numpy, or
    - Simple Gradient Descent MF
5. Reconstructs predicted ratings
6. Recommends top N unseen items for a user
7. Maps item IDs to titles if items CSV is provided
8. Prints predicted matrix preview and sample recommendations
"""

from __future__ import annotations

import argparse
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd


@dataclass
class MatrixFactorizationRecommender:
    ratings_csv: str
    items_csv: str | None = None
    n_factors: int = 20
    method: str = "svd"
    lr: float = 0.005
    reg: float = 0.05
    epochs: int = 20
    random_state: int = 42
    verbose: bool = True

    def __post_init__(self) -> None:
        self.ratings_df: pd.DataFrame | None = None
        self.items_df: pd.DataFrame | None = None
        self.user_item_matrix: pd.DataFrame | None = None
        self.rated_mask: pd.DataFrame | None = None
        self.predicted_matrix: pd.DataFrame | None = None

    def load_data(self) -> None:
        """Load and normalize ratings/items data from CSV files."""
        ratings_df = pd.read_csv(self.ratings_csv)

        # Support both required naming and MovieLens naming.
        ratings_rename_map = {
            "userId": "user_id",
            "movieId": "item_id",
        }
        ratings_df = ratings_df.rename(columns=ratings_rename_map)

        required = {"user_id", "item_id", "rating"}
        missing = required.difference(ratings_df.columns)
        if missing:
            missing_str = ", ".join(sorted(missing))
            raise ValueError(
                f"Ratings CSV is missing required columns: {missing_str}. "
                "Expected user_id,item_id,rating or userId,movieId,rating."
            )

        self.ratings_df = ratings_df[["user_id", "item_id", "rating"]].copy()

        if self.items_csv:
            items_df = pd.read_csv(self.items_csv)
            items_df = items_df.rename(columns={"movieId": "item_id"})

            item_required = {"item_id", "title"}
            item_missing = item_required.difference(items_df.columns)
            if item_missing:
                item_missing_str = ", ".join(sorted(item_missing))
                raise ValueError(
                    f"Items CSV is missing required columns: {item_missing_str}. "
                    "Expected item_id,title or movieId,title."
                )

            self.items_df = items_df[["item_id", "title"]].drop_duplicates("item_id")

    def build_user_item_matrix(self) -> None:
        """Build user-item ratings matrix with NaN for unrated entries."""
        if self.ratings_df is None:
            raise RuntimeError("Data not loaded. Run load_data() first.")

        matrix = self.ratings_df.pivot_table(
            index="user_id",
            columns="item_id",
            values="rating",
            aggfunc="mean",
        )

        self.user_item_matrix = matrix
        self.rated_mask = matrix.notna()

    def fit(self) -> None:
        """Fit model (SVD or gradient descent) and reconstruct predicted ratings matrix."""
        if self.method == "svd":
            self._fit_svd()
        elif self.method == "gd":
            self._fit_gradient_descent()
        else:
            raise ValueError("Invalid method. Use 'svd' or 'gd'.")

    def _fit_svd(self) -> None:
        """Fit truncated SVD and reconstruct predicted ratings matrix."""
        if self.user_item_matrix is None:
            raise RuntimeError("User-item matrix not built. Run build_user_item_matrix() first.")

        # Keep NaNs for masking, but fill with 0 for SVD computation.
        matrix_filled = self.user_item_matrix.fillna(0.0)
        matrix_values = matrix_filled.to_numpy(dtype=float)

        u, s, vt = np.linalg.svd(matrix_values, full_matrices=False)

        max_rank = len(s)
        k = max(1, min(self.n_factors, max_rank))

        u_k = u[:, :k]
        s_k = np.diag(s[:k])
        vt_k = vt[:k, :]

        reconstructed = u_k @ s_k @ vt_k

        self.predicted_matrix = pd.DataFrame(
            reconstructed,
            index=self.user_item_matrix.index,
            columns=self.user_item_matrix.columns,
        )

    def _fit_gradient_descent(self) -> None:
        """Fit a simple matrix factorization model with gradient descent."""
        if self.user_item_matrix is None:
            raise RuntimeError("User-item matrix not built. Run build_user_item_matrix() first.")

        rng = np.random.default_rng(self.random_state)

        matrix = self.user_item_matrix
        matrix_values = matrix.to_numpy(dtype=float)
        observed_mask = ~np.isnan(matrix_values)
        observed_u, observed_i = np.where(observed_mask)
        observed_r = matrix_values[observed_u, observed_i]

        user_ids = matrix.index.to_list()
        item_ids = matrix.columns.to_list()

        n_users = len(user_ids)
        n_items = len(item_ids)
        k = max(1, min(self.n_factors, min(n_users, n_items)))

        # Small random initialization for latent factors.
        u_mat = 0.01 * rng.standard_normal((n_users, k))
        v_mat = 0.01 * rng.standard_normal((n_items, k))

        for epoch in range(1, self.epochs + 1):
            # Shuffle observed rows each epoch for stable SGD behavior.
            order = rng.permutation(len(observed_r))

            for pos in order:
                u_idx = observed_u[pos]
                i_idx = observed_i[pos]
                rating = observed_r[pos]

                pred = float(np.dot(u_mat[u_idx], v_mat[i_idx]))
                pred = float(np.clip(pred, 0.5, 5.0))
                err = rating - pred
                err = float(np.clip(err, -5.0, 5.0))

                # Store copies so updates use same-step values.
                u_old = u_mat[u_idx].copy()
                v_old = v_mat[i_idx].copy()

                u_mat[u_idx] = u_old + self.lr * (err * v_old - self.reg * u_old)
                v_mat[i_idx] = v_old + self.lr * (err * u_old - self.reg * v_old)

                # Guard against divergence in beginner-friendly SGD.
                u_mat[u_idx] = np.clip(np.nan_to_num(u_mat[u_idx], nan=0.0, posinf=0.0, neginf=0.0), -5.0, 5.0)
                v_mat[i_idx] = np.clip(np.nan_to_num(v_mat[i_idx], nan=0.0, posinf=0.0, neginf=0.0), -5.0, 5.0)

            if self.verbose and (epoch % 5 == 0 or epoch == self.epochs):
                rmse = self._rmse_on_index_arrays(observed_u, observed_i, observed_r, u_mat, v_mat)
                print(f"Epoch {epoch:>3}/{self.epochs} | train RMSE: {rmse:.4f}")

        reconstructed = np.clip(np.dot(u_mat, v_mat.T), 0.5, 5.0)
        self.predicted_matrix = pd.DataFrame(
            reconstructed,
            index=matrix.index,
            columns=matrix.columns,
        )

    def _rmse_on_index_arrays(
        self,
        user_idx: np.ndarray,
        item_idx: np.ndarray,
        ratings: np.ndarray,
        u_mat: np.ndarray,
        v_mat: np.ndarray,
    ) -> float:
        """Compute RMSE for pre-indexed arrays of observed ratings."""
        if len(ratings) == 0:
            return float("nan")

        preds = np.sum(u_mat[user_idx] * v_mat[item_idx], axis=1)
        preds = np.clip(preds, 0.5, 5.0)
        errors = ratings - preds
        return float(np.sqrt(np.mean(errors * errors)))

    def evaluate_train_test_rmse(self, test_size: float = 0.2, random_state: int = 42) -> dict:
        """Evaluate model with a random train/test split over known ratings."""
        if self.ratings_df is None:
            raise RuntimeError("Data not loaded. Run load_data() first.")

        ratings = self.ratings_df.copy()
        ratings = ratings.sample(frac=1.0, random_state=random_state).reset_index(drop=True)

        split_idx = int((1.0 - test_size) * len(ratings))
        train_df = ratings.iloc[:split_idx].copy()
        test_df = ratings.iloc[split_idx:].copy()

        train_matrix = train_df.pivot_table(
            index="user_id",
            columns="item_id",
            values="rating",
            aggfunc="mean",
        )

        if self.method == "svd":
            pred_matrix = self._predict_matrix_svd(train_matrix)
        else:
            pred_matrix = self._predict_matrix_gd(train_matrix)

        train_rmse, train_used = self._rmse_from_prediction_df(train_df, pred_matrix)
        test_rmse, test_used = self._rmse_from_prediction_df(test_df, pred_matrix)

        return {
            "train_rmse": train_rmse,
            "test_rmse": test_rmse,
            "train_rows_used": train_used,
            "test_rows_used": test_used,
            "train_rows_total": int(len(train_df)),
            "test_rows_total": int(len(test_df)),
        }

    def _predict_matrix_svd(self, matrix: pd.DataFrame) -> pd.DataFrame:
        """Build prediction matrix from a provided user-item matrix using SVD."""
        filled = matrix.fillna(0.0).to_numpy(dtype=float)
        u, s, vt = np.linalg.svd(filled, full_matrices=False)
        max_rank = len(s)
        k = max(1, min(self.n_factors, max_rank))
        reconstructed = u[:, :k] @ np.diag(s[:k]) @ vt[:k, :]
        return pd.DataFrame(reconstructed, index=matrix.index, columns=matrix.columns)

    def _predict_matrix_gd(self, matrix: pd.DataFrame) -> pd.DataFrame:
        """Build prediction matrix from a provided user-item matrix using GD MF."""
        rng = np.random.default_rng(self.random_state)
        matrix_values = matrix.to_numpy(dtype=float)
        observed_mask = ~np.isnan(matrix_values)
        observed_u, observed_i = np.where(observed_mask)
        observed_r = matrix_values[observed_u, observed_i]

        user_ids = matrix.index.to_list()
        item_ids = matrix.columns.to_list()

        n_users = len(user_ids)
        n_items = len(item_ids)
        k = max(1, min(self.n_factors, min(n_users, n_items)))

        u_mat = 0.01 * rng.standard_normal((n_users, k))
        v_mat = 0.01 * rng.standard_normal((n_items, k))

        for epoch in range(1, self.epochs + 1):
            order = rng.permutation(len(observed_r))
            for pos in order:
                u_idx = observed_u[pos]
                i_idx = observed_i[pos]
                rating = observed_r[pos]

                pred = float(np.dot(u_mat[u_idx], v_mat[i_idx]))
                pred = float(np.clip(pred, 0.5, 5.0))
                err = rating - pred
                err = float(np.clip(err, -5.0, 5.0))

                u_old = u_mat[u_idx].copy()
                v_old = v_mat[i_idx].copy()

                u_mat[u_idx] = u_old + self.lr * (err * v_old - self.reg * u_old)
                v_mat[i_idx] = v_old + self.lr * (err * u_old - self.reg * v_old)

                u_mat[u_idx] = np.clip(np.nan_to_num(u_mat[u_idx], nan=0.0, posinf=0.0, neginf=0.0), -5.0, 5.0)
                v_mat[i_idx] = np.clip(np.nan_to_num(v_mat[i_idx], nan=0.0, posinf=0.0, neginf=0.0), -5.0, 5.0)

            reconstructed = np.clip(np.dot(u_mat, v_mat.T), 0.5, 5.0)
        return pd.DataFrame(reconstructed, index=matrix.index, columns=matrix.columns)

    def _rmse_from_prediction_df(self, rows_df: pd.DataFrame, pred_df: pd.DataFrame) -> tuple[float, int]:
        """Compute RMSE for ratings rows that exist in prediction matrix indices/columns."""
        sq_errors = []
        used = 0

        for row in rows_df.itertuples(index=False):
            user_id = row.user_id
            item_id = row.item_id
            if user_id not in pred_df.index or item_id not in pred_df.columns:
                continue

            pred = float(pred_df.loc[user_id, item_id])
            pred = float(np.clip(pred, 0.5, 5.0))
            err = float(row.rating) - pred
            sq_errors.append(err * err)
            used += 1

        if not sq_errors:
            return float("nan"), used

        return float(np.sqrt(np.mean(sq_errors))), used

    def save_predicted_matrix(self, output_csv: str) -> None:
        """Save the full predicted rating matrix to CSV."""
        if self.predicted_matrix is None:
            raise RuntimeError("Model not fitted. Run fit() first.")

        out_path = Path(output_csv)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        self.predicted_matrix.to_csv(out_path)
        if self.verbose:
            print(f"\nSaved predicted matrix to: {out_path}")

    def recommend_records(self, user_id: int, top_n: int = 5) -> list[dict]:
        """Return recommendations as JSON-serializable records."""
        rec_df = self.recommend(user_id=user_id, top_n=top_n)
        records = rec_df.to_dict(orient="records")

        clean_records = []
        for row in records:
            clean_row = {
                "item_id": int(row["item_id"]),
                "predicted_rating": float(row["predicted_rating"]),
            }
            if "title" in row:
                title = row["title"]
                clean_row["title"] = None if pd.isna(title) else str(title)
            clean_records.append(clean_row)

        return clean_records

    def recommend(self, user_id: int, top_n: int = 5) -> pd.DataFrame:
        """Return top N recommendations for items not yet rated by the user."""
        if self.predicted_matrix is None or self.user_item_matrix is None:
            raise RuntimeError("Model not fitted. Run fit() first.")

        if user_id not in self.predicted_matrix.index:
            raise ValueError(f"User {user_id} was not found in the ratings data.")

        user_pred = self.predicted_matrix.loc[user_id]
        already_rated = self.user_item_matrix.loc[user_id].notna()

        candidates = user_pred[~already_rated].sort_values(ascending=False).head(top_n)

        rec_df = pd.DataFrame(
            {
                "item_id": candidates.index.astype(int),
                "predicted_rating": candidates.values,
            }
        )

        if self.items_df is not None:
            rec_df = rec_df.merge(self.items_df, on="item_id", how="left")
            rec_df = rec_df[["item_id", "title", "predicted_rating"]]

        return rec_df

    def print_predicted_matrix(self, max_users: int = 10, max_items: int = 10) -> None:
        """Print a readable preview of predicted ratings matrix."""
        if self.predicted_matrix is None:
            raise RuntimeError("Model not fitted. Run fit() first.")

        preview = self.predicted_matrix.iloc[:max_users, :max_items].round(3)
        print("\nPredicted ratings matrix (preview):")
        print(preview)

    def print_top_recommendations(self, user_id: int, top_n: int = 5) -> None:
        """Print top N recommendations for a specific user."""
        rec_df = self.recommend(user_id=user_id, top_n=top_n)
        print(f"\nTop {top_n} recommendations for user {user_id}:")
        print(rec_df.to_string(index=False))

    def test_with_sample_users(self, num_users: int = 3, top_n: int = 5) -> None:
        """Test recommendations on sample users with the most ratings."""
        if self.ratings_df is None:
            raise RuntimeError("Data not loaded. Run load_data() first.")

        user_counts = self.ratings_df["user_id"].value_counts()
        sample_users = user_counts.head(num_users).index.tolist()

        print(f"\nTesting with {len(sample_users)} sample users: {sample_users}")
        for uid in sample_users:
            self.print_top_recommendations(user_id=int(uid), top_n=top_n)


def parse_args() -> argparse.Namespace:
    default_dir = Path(__file__).resolve().parent

    parser = argparse.ArgumentParser(description="Simple Matrix Factorization recommender.")
    parser.add_argument(
        "--ratings-csv",
        type=str,
        default=str(default_dir / "ratings.csv"),
        help="Path to ratings CSV",
    )
    parser.add_argument(
        "--items-csv",
        type=str,
        default=str(default_dir / "movies.csv"),
        help="Optional path to items CSV with item_id/title",
    )
    parser.add_argument(
        "--n-factors",
        type=int,
        default=20,
        help="Number of latent factors (default: 20)",
    )
    parser.add_argument(
        "--method",
        type=str,
        choices=["svd", "gd"],
        default="svd",
        help="Matrix factorization method: svd or gd (default: svd)",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=20,
        help="Training epochs for GD method (default: 20)",
    )
    parser.add_argument(
        "--lr",
        type=float,
        default=0.005,
        help="Learning rate for GD method (default: 0.005)",
    )
    parser.add_argument(
        "--reg",
        type=float,
        default=0.05,
        help="L2 regularization for GD method (default: 0.05)",
    )
    parser.add_argument(
        "--evaluate",
        action="store_true",
        help="Run train/test RMSE evaluation",
    )
    parser.add_argument(
        "--test-size",
        type=float,
        default=0.2,
        help="Test split fraction for evaluation (default: 0.2)",
    )
    parser.add_argument(
        "--save-predictions",
        type=str,
        default=None,
        help="Optional output CSV path to save full predicted matrix",
    )
    parser.add_argument(
        "--user-id",
        type=int,
        default=None,
        help="User ID for recommendation output (default: first user in matrix)",
    )
    parser.add_argument(
        "--top-n",
        type=int,
        default=5,
        help="Number of recommendations to show (default: 5)",
    )
    parser.add_argument(
        "--sample-users",
        type=int,
        default=3,
        help="How many sample users to test (default: 3)",
    )
    parser.add_argument(
        "--no-preview",
        action="store_true",
        help="Skip predicted-matrix preview output",
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Reduce console output",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print only JSON output payload for programmatic use",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    ratings_path = Path(args.ratings_csv)
    items_path = Path(args.items_csv) if args.items_csv else None
    is_quiet = args.quiet or args.json

    if not ratings_path.exists():
        raise FileNotFoundError(f"Ratings file not found: {ratings_path}")
    if items_path is not None and not items_path.exists():
        if not is_quiet:
            print(f"Items file not found at {items_path}. Continuing without item titles.")
        items_path = None

    recommender = MatrixFactorizationRecommender(
        ratings_csv=str(ratings_path),
        items_csv=str(items_path) if items_path else None,
        n_factors=args.n_factors,
        method=args.method,
        lr=args.lr,
        reg=args.reg,
        epochs=args.epochs,
        verbose=not is_quiet,
    )

    recommender.load_data()
    recommender.build_user_item_matrix()
    recommender.fit()

    eval_result = None
    if args.evaluate:
        eval_result = recommender.evaluate_train_test_rmse(
            test_size=args.test_size,
            random_state=42,
        )
        if not is_quiet:
            print("\nTrain/Test RMSE evaluation:")
            print(
                "Train RMSE: "
                f"{eval_result['train_rmse']:.4f} "
                f"(used {eval_result['train_rows_used']}/{eval_result['train_rows_total']} rows)"
            )
            print(
                "Test RMSE:  "
                f"{eval_result['test_rmse']:.4f} "
                f"(used {eval_result['test_rows_used']}/{eval_result['test_rows_total']} rows)"
            )

    if args.user_id is not None:
        target_user = args.user_id
    else:
        target_user = int(recommender.user_item_matrix.index[0])

    if args.json:
        result = {
            "method": args.method,
            "n_factors": args.n_factors,
            "user_id": target_user,
            "top_n": args.top_n,
            "recommendations": recommender.recommend_records(user_id=target_user, top_n=args.top_n),
        }
        if eval_result is not None:
            result["evaluation"] = eval_result
        print(json.dumps(result))
        return

    # Required output: predicted ratings matrix.
    if not args.no_preview:
        recommender.print_predicted_matrix(max_users=10, max_items=10)

    recommender.print_top_recommendations(user_id=target_user, top_n=args.top_n)

    if args.save_predictions:
        recommender.save_predicted_matrix(args.save_predictions)

    # Bonus/testing helper: run recommendations for multiple sample users.
    if args.sample_users > 0:
        recommender.test_with_sample_users(num_users=args.sample_users, top_n=args.top_n)


if __name__ == "__main__":
    main()
