import json
import sys
from pathlib import Path
from dataclasses import dataclass
from collections import defaultdict

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MultiLabelBinarizer



# fast and simple ID_rec.py


class SimpleRecommender:
    
    def __init__(self, data_file='movielens_combined.csv'):
        print("  Loading Simple Recommender...")
        self.data = pd.read_csv(data_file)
        self.data['genres_list'] = self.data['genres_list'].apply(eval)
        self.train_data = self.data[self.data['split'] == 'train']
        
        # Movie stats
        self.movie_stats = {}
        for movie_id, group in self.train_data.groupby('movieId'):
            first = group.iloc[0]
            self.movie_stats[movie_id] = {
                'title': first['title'],
                'genres_list': first['genres_list'],
                'avg_rating': group['rating'].mean(),
                'count': len(group)
            }
        
        # User profiles
        self.user_profiles = {}
        for user_id in self.train_data['userId'].unique():
            user_data = self.train_data[self.train_data['userId'] == user_id]
            rated = set()
            genre_prefs = {}
            
            for _, row in user_data.iterrows():
                movie_id = row['movieId']
                if movie_id in self.movie_stats:
                    rated.add(movie_id)
                    for genre in self.movie_stats[movie_id]['genres_list']:
                        genre_prefs[genre] = genre_prefs.get(genre, 0) + row['rating']
            
            if genre_prefs:
                max_pref = max(genre_prefs.values())
                normalized_prefs = {g: s/max_pref for g, s in genre_prefs.items()}
            else:
                normalized_prefs = {}
                
            self.user_profiles[user_id] = {'rated': rated, 'genre_prefs': normalized_prefs}
    
    def recommend(self, user_id, n=10):
        if user_id not in self.user_profiles:
            return []
        
        user = self.user_profiles[user_id]
        scores = []
        
        for movie_id, stats in self.movie_stats.items():
            if movie_id in user['rated']:
                continue
            
            rating_score = stats['avg_rating'] / 5.0
            genre_score = 0
            if user['genre_prefs']:
                matches = sum(user['genre_prefs'].get(g, 0) for g in stats['genres_list'])
                genre_score = matches / max(1, len(stats['genres_list']))
            
            score = 0.4 * rating_score + 0.6 * genre_score
            scores.append({
                'movie_id': movie_id,
                'title': stats['title'],
                'score': score,
                'model': 'Simple'
            })
        
        scores.sort(key=lambda x: x['score'], reverse=True)
        return scores[:n]



# matrix factorization using SVD


class MatrixFactorizationRecommender:
    
    def __init__(self, ratings_csv='ratings.csv', items_csv='movies.csv'):
        print("  Loading Matrix Factorization Recommender...")
        self.ratings_csv = ratings_csv
        self.items_csv = items_csv
        self.predicted_matrix = None
        self.user_item_matrix = None
        self.item_titles = {}
        self._load_data()
        self._build_matrix()
        self._fit()
    
    def _load_data(self):
        ratings_df = pd.read_csv(self.ratings_csv)
        ratings_df = ratings_df.rename(columns={"userId": "user_id", "movieId": "item_id"})
        self.ratings_df = ratings_df[['user_id', 'item_id', 'rating']].copy()
        
        if self.items_csv:
            items_df = pd.read_csv(self.items_csv)
            items_df = items_df.rename(columns={"movieId": "item_id"})
            self.item_titles = dict(zip(items_df['item_id'], items_df['title']))
    
    def _build_matrix(self):
        matrix = self.ratings_df.pivot_table(
            index='user_id', columns='item_id', values='rating', aggfunc='mean'
        )
        self.user_item_matrix = matrix
        self.user_ids = matrix.index.tolist()
        self.item_ids = matrix.columns.tolist()
    
    def _fit(self, n_factors=20):
        # Use SVD for simplicity and speed
        matrix_filled = self.user_item_matrix.fillna(0.0).to_numpy()
        u, s, vt = np.linalg.svd(matrix_filled, full_matrices=False)
        k = min(n_factors, len(s))
        reconstructed = u[:, :k] @ np.diag(s[:k]) @ vt[:k, :]
        self.predicted_matrix = pd.DataFrame(
            reconstructed, index=self.user_item_matrix.index, columns=self.user_item_matrix.columns
        )
    
    def recommend(self, user_id, n=10):
        if user_id not in self.predicted_matrix.index:
            return []
        
        user_pred = self.predicted_matrix.loc[user_id]
        already_rated = self.user_item_matrix.loc[user_id].notna()
        candidates = user_pred[~already_rated].sort_values(ascending=False).head(n)
        
        return [{
            'movie_id': item_id,
            'title': self.item_titles.get(item_id, f"Movie_{item_id}"),
            'score': score,
            'model': 'Matrix Factorization'
        } for item_id, score in candidates.items()]



# WiziAN-Dual One-Class Collaborative Filtering (I don't fully understand how this works lol)


class WizanRecommender:
    
    def __init__(self, ratings_csv='ratings.csv', movies_csv='movies.csv'):
        print("  Loading wiZAN-Dual Recommender...")
        self.ratings_csv = ratings_csv
        self.movies_csv = movies_csv
        self.F = None
        self.G = None
        self.user_ids = None
        self.item_ids = None
        self.item_titles = {}
        self._load_and_train()
    
    def _load_one_class(self, threshold=4.0):
        df = pd.read_csv(self.ratings_csv).rename(columns={"userId": "user_id", "movieId": "item_id"})
        pos = df[df["rating"] >= threshold][["user_id", "item_id"]].drop_duplicates()
        self.user_ids = sorted(pos["user_id"].unique().tolist())
        self.item_ids = sorted(pos["item_id"].unique().tolist())
        
        uidx = {u: i for i, u in enumerate(self.user_ids)}
        iidx = {it: i for i, it in enumerate(self.item_ids)}
        rows = [uidx[u] for u in pos["user_id"]]
        cols = [iidx[it] for it in pos["item_id"]]
        self.R = csr_matrix((np.ones(len(rows)), (rows, cols)), 
                            shape=(len(self.user_ids), len(self.item_ids)))
        
        movies = pd.read_csv(self.movies_csv).rename(columns={"movieId": "item_id"})
        self.item_titles = dict(zip(movies["item_id"], movies["title"]))
    
    def _build_graphs(self, sim_threshold=0.4, jac_threshold=0.05):
        # Item graph from genres
        movies = pd.read_csv(self.movies_csv).rename(columns={"movieId": "item_id"})
        movies = movies[movies["item_id"].isin(self.item_ids)].copy()
        movies["gl"] = movies["genres"].apply(lambda g: g.split("|") if isinstance(g, str) else [])
        mlb = MultiLabelBinarizer()
        genre_matrix = mlb.fit_transform(movies["gl"])
        
        iidx = {it: i for i, it in enumerate(self.item_ids)}
        n = len(self.item_ids)
        full = np.zeros((n, genre_matrix.shape[1]), np.float32)
        for li, iid in enumerate(movies["item_id"]):
            if iid in iidx:
                full[iidx[iid]] = genre_matrix[li]
        
        sim = cosine_similarity(full)
        self.N = (sim > sim_threshold).astype(np.float32)
        np.fill_diagonal(self.N, 0.0)
        
        # User graph from Jaccard similarity
        R_bin = (self.R > 0).astype(np.float32)
        inter = R_bin.dot(R_bin.T).toarray()
        rs = np.array(R_bin.sum(axis=1)).flatten()
        union = rs[:, None] + rs[None, :] - inter
        with np.errstate(divide='ignore', invalid='ignore'):
            jac = np.where(union > 0, inter / union, 0.0)
        self.M = (jac > jac_threshold).astype(np.float32)
        np.fill_diagonal(self.M, 0.0)
    
    def _train(self, rank=10, w=0.01, p=0.01, lambda_r=0.1, lambda_F=1.0, lambda_G=0.1, max_iter=30):
        rng = np.random.default_rng(42)
        m, n = self.R.shape
        self.F = np.abs(rng.standard_normal((m, rank))) * 0.1 + 0.01
        self.G = np.abs(rng.standard_normal((n, rank))) * 0.1 + 0.01
        
        D_M = np.diag(self.M.sum(axis=1))
        D_N = np.diag(self.N.sum(axis=1))
        R_d = self.R.toarray()
        ones_n = np.ones((1, n))
        ones_m = np.ones((1, m))
        eps = 1e-10
        
        for _ in range(max_iter):
            # Update F
            R1 = self._compute_R1_tilde(self.F, self.G)
            GtG = self.G.T @ self.G
            A1 = (1 - w*p)*(R_d @ self.G) + w*p*np.ones((m,1))@(ones_n@self.G) + lambda_F*(self.M @ self.F)
            B1 = (1 - w)*(R1 @ self.G) + w*(self.F @ GtG) + lambda_r*self.F + lambda_F*(D_M @ self.F)
            F_new = self.F * np.sqrt(np.maximum(A1, eps) / np.maximum(B1, eps))
            
            # Update G
            R1 = self._compute_R1_tilde(F_new, self.G)
            FtF = F_new.T @ F_new
            A2 = (1 - w*p)*(R_d.T @ F_new) + w*p*np.ones((n,1))@(ones_m @ F_new) + lambda_G*(self.N @ self.G)
            B2 = (1 - w)*(R1.T @ F_new) + w*(self.G @ FtF) + lambda_r*self.G + lambda_G*(D_N @ self.G)
            G_new = self.G * np.sqrt(np.maximum(A2, eps) / np.maximum(B2, eps))
            
            self.F, self.G = F_new, G_new
    
    def _compute_R1_tilde(self, F, G):
        rows, cols = self.R.nonzero()
        vals = np.einsum("ij,ij->i", F[rows], G[cols])
        return csr_matrix((vals, (rows, cols)), shape=self.R.shape).toarray()
    
    def _load_and_train(self):
        self._load_one_class()
        if len(self.user_ids) > 0 and len(self.item_ids) > 0:
            self._build_graphs()
            self._train()
    
    def recommend(self, user_id, n=10):
        if user_id not in self.user_ids:
            return []
        
        u_idx = self.user_ids.index(user_id)
        scores = self.F[u_idx] @ self.G.T
        
        df = pd.read_csv(self.ratings_csv).rename(columns={"userId": "user_id", "movieId": "item_id"})
        seen = set(df[df["user_id"] == user_id]["item_id"].tolist())
        
        ranked = sorted([(self.item_ids[i], float(scores[i])) for i in range(len(self.item_ids)) 
                        if self.item_ids[i] not in seen], key=lambda x: -x[1])[:n]
        
        return [{'movie_id': mid, 'title': self.item_titles.get(mid, f"Movie_{mid}"), 
                 'score': score, 'model': 'wiZAN-Dual'} for mid, score in ranked]



# combine all three and take average

class EnsembleRecommender:
    
    def __init__(self):
        print("\n" + "="*80)
        print("INITIALIZING ALL RECOMMENDER MODELS")
        print("="*80)
        
        self.models = {}
        
        # Try to initialize Simple Recommender
        try:
            self.models['simple'] = SimpleRecommender('movielens_combined.csv')
            print("  ✓ Simple Recommender ready")
        except Exception as e:
            print(f"  ✗ Simple Recommender failed: {e}")
        
        # Try to initialize Matrix Factorization
        try:
            self.models['mf'] = MatrixFactorizationRecommender('ratings.csv', 'movies.csv')
            print("  ✓ Matrix Factorization ready")
        except Exception as e:
            print(f"  ✗ Matrix Factorization failed: {e}")
        
        # Try to initialize wiZAN-Dual
        try:
            self.models['wizan'] = WizanRecommender('ratings.csv', 'movies.csv')
            print("  ✓ wiZAN-Dual ready")
        except Exception as e:
            print(f"  ✗ wiZAN-Dual failed: {e}")
        
        print(f"\n{len(self.models)} models loaded successfully")
    
    def recommend_all(self, user_id, n=10):
        results = {}
        
        for name, model in self.models.items():
            try:
                recs = model.recommend(user_id, n)
                if recs:
                    results[name] = recs
                else:
                    print(f"  {name}: No recommendations found")
            except Exception as e:
                print(f"  {name}: Error - {e}")
        
        return results
    
    def recommend_ensemble_mean(self, user_id, n=10):
        all_recs = self.recommend_all(user_id, n * 2)  # Get more for better averaging
        
        # Aggregate scores by movie
        movie_scores = defaultdict(list)
        movie_titles = {}
        
        for model_name, recs in all_recs.items():
            for rec in recs:
                movie_id = rec['movie_id']
                movie_scores[movie_id].append(rec['score'])
                movie_titles[movie_id] = rec['title']
        
        # Calculate mean scores
        combined = []
        for movie_id, scores in movie_scores.items():
            combined.append({
                'movie_id': movie_id,
                'title': movie_titles[movie_id],
                'score': np.mean(scores),
                'num_models': len(scores),
                'individual_scores': dict(zip(all_recs.keys(), scores))
            })
        
        combined.sort(key=lambda x: x['score'], reverse=True)
        return combined[:n]
    
    def print_comparison_table(self, user_id, n=10):
        print("\n" + "="*80)
        print(f"RECOMMENDATIONS FOR USER {user_id}")
        print("="*80)
        
        # Get recommendations from all models
        results = self.recommend_all(user_id, n)
        
        if not results:
            print("No recommendations available from any model")
            return
        
        # Print individual model results
        for model_name, recs in results.items():
            print(f"\n{'='*40}")
            print(f"{model_name.upper()} RECOMMENDATIONS")
            print('='*40)
            for i, rec in enumerate(recs[:n], 1):
                print(f"{i:2}. {rec['title'][:55]:55} ({rec['score']:.4f})")
        
        # Print ensemble (mean) results
        print(f"\n{'='*40}")
        print("ENSEMBLE (MEAN OF ALL MODELS)")
        print('='*40)
        ensemble_recs = self.recommend_ensemble_mean(user_id, n)
        
        for i, rec in enumerate(ensemble_recs, 1):
            print(f"{i:2}. {rec['title'][:50]:50} ({rec['score']:.4f})")
            print(f"    Combined from {rec['num_models']} models")
        
        # Print detailed comparison for top 5
        print(f"\n{'='*80}")
        print("DETAILED COMPARISON (Top 5 from Ensemble)")
        print('='*80)
        
        for i, rec in enumerate(ensemble_recs[:5], 1):
            print(f"\n{i}. {rec['title']}")
            print(f"   Ensemble Score: {rec['score']:.4f}")
            print("   Individual Model Scores:")
            for model_name, score in rec['individual_scores'].items():
                print(f"     - {model_name:12}: {score:.4f}")



# main excecution

def main():
    print("="*80)
    print("UNIFIED RECOMMENDER SYSTEM - RUNNING ALL MODELS")
    print("="*80)
    
    # Initialize ensemble recommender
    ensemble = EnsembleRecommender()
    
    # Get available users
    available_users = []
    if 'simple' in ensemble.models:
        available_users = list(ensemble.models['simple'].user_profiles.keys())[:20]
        print(f"\nAvailable user IDs (sample): {available_users[:10]}...")
    
    # Get user input
    while True:
        print("\n" + "-"*80)
        user_input = input("Enter a user ID to get recommendations from all models (or 'quit' to exit): ").strip()
        
        if user_input.lower() in ['quit', 'q']:
            print("\nThank you for using the Unified Recommender System!")
            break
        
        try:
            user_id = int(user_input)
            ensemble.print_comparison_table(user_id, n=10)
            
        except ValueError:
            print("\nPlease enter a valid user ID (number) or 'quit' to exit")
        except KeyboardInterrupt:
            print("\n\nExiting...")
            break


if __name__ == "__main__":
    main()