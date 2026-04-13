"""
Recommender System Testing Framework
Evaluates all models using train/test split with multiple metrics

Usage:
    python test_recommenders.py
    python test_recommenders.py --models simple,mf,wizan --test-size 0.2
"""

import argparse
import json
import time
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from scipy.sparse import csr_matrix
from sklearn.metrics import mean_squared_error, mean_absolute_error
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import MultiLabelBinarizer


# ============================================================================
# MODEL DEFINITIONS (Simplified versions for testing)
# ============================================================================

class SimpleRecommenderTest:
    """Simple content-based recommender for testing"""
    
    def __init__(self, train_data):
        self.train_data = train_data
        self.movie_stats = {}
        self.user_profiles = {}
        self._build_movie_stats()
        self._build_user_profiles()
    
    def _build_movie_stats(self):
        for movie_id, group in self.train_data.groupby('movieId'):
            first = group.iloc[0]
            self.movie_stats[movie_id] = {
                'title': first['title'],
                'genres_list': first['genres_list'] if 'genres_list' in first else [],
                'avg_rating': group['rating'].mean(),
                'count': len(group)
            }
    
    def _build_user_profiles(self):
        for user_id in self.train_data['userId'].unique():
            user_data = self.train_data[self.train_data['userId'] == user_id]
            rated = set()
            genre_prefs = {}
            
            for _, row in user_data.iterrows():
                movie_id = row['movieId']
                if movie_id in self.movie_stats:
                    rated.add(movie_id)
                    for genre in self.movie_stats[movie_id].get('genres_list', []):
                        genre_prefs[genre] = genre_prefs.get(genre, 0) + row['rating']
            
            if genre_prefs:
                max_pref = max(genre_prefs.values())
                normalized_prefs = {g: s/max_pref for g, s in genre_prefs.items()}
            else:
                normalized_prefs = {}
                
            self.user_profiles[user_id] = {'rated': rated, 'genre_prefs': normalized_prefs}
    
    def predict(self, user_id, movie_id):
        """Predict rating for a specific user-movie pair"""
        if user_id not in self.user_profiles or movie_id not in self.movie_stats:
            return 2.5  # Default neutral rating
        
        user = self.user_profiles[user_id]
        stats = self.movie_stats[movie_id]
        
        rating_score = stats['avg_rating'] / 5.0
        genre_score = 0
        if user['genre_prefs']:
            matches = sum(user['genre_prefs'].get(g, 0) for g in stats.get('genres_list', []))
            genre_score = matches / max(1, len(stats.get('genres_list', [])))
        
        score = 0.4 * rating_score + 0.6 * genre_score
        return score * 5  # Scale back to 1-5 range


class MatrixFactorizationTest:
    """Matrix Factorization for testing"""
    
    def __init__(self, train_data, n_factors=20):
        self.train_data = train_data
        self.n_factors = n_factors
        self.user_factors = None
        self.item_factors = None
        self.user_ids = None
        self.item_ids = None
        self._build_matrix()
        self._fit_svd()
    
    def _build_matrix(self):
        # Create user-item matrix from training data
        self.user_ids = self.train_data['userId'].unique()
        self.item_ids = self.train_data['movieId'].unique()
        
        user_idx = {u: i for i, u in enumerate(self.user_ids)}
        item_idx = {m: i for i, m in enumerate(self.item_ids)}
        
        n_users, n_items = len(self.user_ids), len(self.item_ids)
        self.matrix = np.full((n_users, n_items), np.nan)
        
        for _, row in self.train_data.iterrows():
            u_idx = user_idx[row['userId']]
            i_idx = item_idx[row['movieId']]
            self.matrix[u_idx, i_idx] = row['rating']
    
    def _fit_svd(self):
        # Fill NaN with column means
        col_means = np.nanmean(self.matrix, axis=0)
        matrix_filled = self.matrix.copy()
        for i in range(matrix_filled.shape[1]):
            matrix_filled[np.isnan(matrix_filled[:, i]), i] = col_means[i]
        
        # SVD
        u, s, vt = np.linalg.svd(matrix_filled, full_matrices=False)
        k = min(self.n_factors, len(s))
        self.user_factors = u[:, :k] @ np.diag(s[:k])
        self.item_factors = vt[:k, :].T
    
    def predict(self, user_id, movie_id):
        """Predict rating for a specific user-movie pair"""
        if user_id not in self.user_ids or movie_id not in self.item_ids:
            return 2.5
        
        u_idx = np.where(self.user_ids == user_id)[0][0]
        i_idx = np.where(self.item_ids == movie_id)[0][0]
        
        pred = self.user_factors[u_idx] @ self.item_factors[i_idx]
        return np.clip(pred, 1.0, 5.0)


class WizanTest:
    """Simplified wiZAN-Dual for testing"""
    
    def __init__(self, train_data, rank=10):
        self.train_data = train_data
        self.rank = rank
        self.user_factors = None
        self.item_factors = None
        self.user_ids = None
        self.item_ids = None
        self._build_one_class()
        self._train()
    
    def _build_one_class(self, threshold=4.0):
        # Build one-class matrix (rating >= 4 = positive)
        self.user_ids = self.train_data['userId'].unique()
        self.item_ids = self.train_data['movieId'].unique()
        
        user_idx = {u: i for i, u in enumerate(self.user_ids)}
        item_idx = {m: i for i, m in enumerate(self.item_ids)}
        
        n_users, n_items = len(self.user_ids), len(self.item_ids)
        self.R = csr_matrix((n_users, n_items), dtype=np.float32)
        
        pos_data = self.train_data[self.train_data['rating'] >= threshold]
        rows = [user_idx[u] for u in pos_data['userId']]
        cols = [item_idx[m] for m in pos_data['movieId']]
        self.R = csr_matrix((np.ones(len(rows)), (rows, cols)), shape=(n_users, n_items))
    
    def _train(self, max_iter=30):
        m, n = self.R.shape
        rng = np.random.default_rng(42)
        
        self.user_factors = np.abs(rng.standard_normal((m, self.rank))) * 0.1 + 0.01
        self.item_factors = np.abs(rng.standard_normal((n, self.rank))) * 0.1 + 0.01
        
        # Simplified training (just one-class MF without graphs for speed)
        for _ in range(max_iter):
            # Update user factors
            for u in range(m):
                pos_items = self.R[u].indices
                if len(pos_items) > 0:
                    for i in pos_items:
                        pred = self.user_factors[u] @ self.item_factors[i]
                        err = 1.0 - pred
                        self.user_factors[u] += 0.01 * err * self.item_factors[i]
                        self.item_factors[i] += 0.01 * err * self.user_factors[u]
    
    def predict(self, user_id, movie_id):
        """Predict probability of positive feedback (scaled to 1-5)"""
        if user_id not in self.user_ids or movie_id not in self.item_ids:
            return 2.5
        
        u_idx = np.where(self.user_ids == user_id)[0][0]
        i_idx = np.where(self.item_ids == movie_id)[0][0]
        
        pred = self.user_factors[u_idx] @ self.item_factors[i_idx]
        # Scale from [0,1] probability to [1,5] rating
        return 1 + 4 * np.clip(pred, 0, 1)


# ============================================================================
# ENSEMBLE MODEL
# ============================================================================

class EnsembleRecommenderTest:
    """Combines multiple models by averaging predictions"""
    
    def __init__(self, models):
        self.models = models
    
    def predict(self, user_id, movie_id):
        """Average predictions from all models"""
        predictions = []
        for model in self.models:
            try:
                pred = model.predict(user_id, movie_id)
                predictions.append(pred)
            except:
                pass
        
        if predictions:
            return np.mean(predictions)
        return 2.5


# ============================================================================
# EVALUATION METRICS
# ============================================================================

class RecommenderEvaluator:
    """Comprehensive evaluation framework"""
    
    def __init__(self, train_data, test_data):
        self.train_data = train_data
        self.test_data = test_data
        self.results = {}
    
    def evaluate_model(self, model, model_name):
        """Evaluate a single model on test data"""
        print(f"  Evaluating {model_name}...")
        
        predictions = []
        actuals = []
        user_times = []
        
        # Group by user for user-level metrics
        user_predictions = defaultdict(list)
        user_actuals = defaultdict(list)
        
        start_time = time.time()
        
        for _, row in self.test_data.iterrows():
            user_id = row['userId']
            movie_id = row['movieId']
            actual = row['rating']
            
            pred = model.predict(user_id, movie_id)
            
            predictions.append(pred)
            actuals.append(actual)
            user_predictions[user_id].append(pred)
            user_actuals[user_id].append(actual)
        
        eval_time = time.time() - start_time
        
        # Calculate metrics
        results = self._calculate_metrics(predictions, actuals, user_predictions, user_actuals)
        results['evaluation_time'] = eval_time
        results['num_predictions'] = len(predictions)
        
        return results
    
    def _calculate_metrics(self, predictions, actuals, user_predictions, user_actuals):
        """Calculate all evaluation metrics"""
        
        # Global metrics
        mse = mean_squared_error(actuals, predictions)
        rmse = np.sqrt(mse)
        mae = mean_absolute_error(actuals, predictions)
        
        # User-level metrics
        user_rmse = []
        user_mae = []
        user_corr = []
        
        for user_id in user_predictions:
            if len(user_predictions[user_id]) > 1:
                user_rmse.append(np.sqrt(mean_squared_error(
                    user_actuals[user_id], user_predictions[user_id]
                )))
                user_mae.append(mean_absolute_error(
                    user_actuals[user_id], user_predictions[user_id]
                ))
                
                # Pearson correlation
                pred_arr = np.array(user_predictions[user_id])
                actual_arr = np.array(user_actuals[user_id])
                if len(pred_arr) > 1 and np.std(pred_arr) > 0 and np.std(actual_arr) > 0:
                    corr = np.corrcoef(pred_arr, actual_arr)[0, 1]
                    user_corr.append(corr if not np.isnan(corr) else 0)
        
        # Prediction bias analysis
        errors = np.array(predictions) - np.array(actuals)
        
        # Metrics by rating level
        rating_level_mae = {}
        for rating in range(1, 6):
            mask = np.array(actuals) == rating
            if np.any(mask):
                rating_level_mae[f'rating_{rating}'] = mean_absolute_error(
                    np.array(actuals)[mask], np.array(predictions)[mask]
                )
        
        return {
            'RMSE': rmse,
            'MSE': mse,
            'MAE': mae,
            'user_RMSE_mean': np.mean(user_rmse) if user_rmse else 0,
            'user_RMSE_std': np.std(user_rmse) if user_rmse else 0,
            'user_MAE_mean': np.mean(user_mae) if user_mae else 0,
            'user_correlation_mean': np.mean(user_corr) if user_corr else 0,
            'prediction_bias_mean': np.mean(errors),
            'prediction_bias_std': np.std(errors),
            'rating_level_MAE': rating_level_mae,
            'num_users_evaluated': len(user_predictions)
        }
    
    def compare_models(self, models_dict):
        """Compare multiple models side by side"""
        
        print("\n" + "="*100)
        print("EVALUATION RESULTS")
        print("="*100)
        
        # Evaluate each model
        for name, model in models_dict.items():
            self.results[name] = self.evaluate_model(model, name)
        
        # Create comparison table
        self._print_comparison_table()
        self._print_detailed_analysis()
        
        return self.results
    
    def _print_comparison_table(self):
        """Print main comparison table"""
        
        print("\n" + "="*100)
        print("MODEL COMPARISON TABLE")
        print("="*100)
        
        # Header
        print(f"{'Model':<20} {'RMSE':<10} {'MAE':<10} {'User RMSE':<12} {'User Corr':<12} {'Time (s)':<10}")
        print("-"*100)
        
        # Results
        for name, results in sorted(self.results.items(), key=lambda x: x[1]['RMSE']):
            print(f"{name:<20} {results['RMSE']:<10.4f} {results['MAE']:<10.4f} "
                  f"{results['user_RMSE_mean']:<12.4f} {results['user_correlation_mean']:<12.4f} "
                  f"{results['evaluation_time']:<10.2f}")
        
        # Best model indicators
        best_rmse = min(self.results.items(), key=lambda x: x[1]['RMSE'])
        best_mae = min(self.results.items(), key=lambda x: x[1]['MAE'])
        best_corr = max(self.results.items(), key=lambda x: x[1]['user_correlation_mean'])
        
        print("\n" + "="*100)
        print("BEST PERFORMERS:")
        print(f"  Lowest RMSE: {best_rmse[0]} ({best_rmse[1]['RMSE']:.4f})")
        print(f"  Lowest MAE:  {best_mae[0]} ({best_mae[1]['MAE']:.4f})")
        print(f"  Highest User Correlation: {best_corr[0]} ({best_corr[1]['user_correlation_mean']:.4f})")
    
    def _print_detailed_analysis(self):
        """Print detailed analysis for each model"""
        
        for name, results in self.results.items():
            print(f"\n{'='*80}")
            print(f"DETAILED ANALYSIS: {name.upper()}")
            print('='*80)
            
            print(f"\nGlobal Metrics:")
            print(f"  • RMSE: {results['RMSE']:.4f}")
            print(f"  • MAE:  {results['MAE']:.4f}")
            print(f"  • MSE:  {results['MSE']:.4f}")
            
            print(f"\nUser-Level Metrics (across {results['num_users_evaluated']} users):")
            print(f"  • Average User RMSE: {results['user_RMSE_mean']:.4f} (±{results['user_RMSE_std']:.4f})")
            print(f"  • Average User MAE:  {results['user_MAE_mean']:.4f}")
            print(f"  • Average User Correlation: {results['user_correlation_mean']:.4f}")
            
            print(f"\nPrediction Bias Analysis:")
            print(f"  • Mean Prediction Error: {results['prediction_bias_mean']:.4f}")
            print(f"  • Std Prediction Error:  {results['prediction_bias_std']:.4f}")
            
            print(f"\nPerformance by Rating Level (MAE):")
            for rating, mae in results['rating_level_MAE'].items():
                print(f"  • {rating}: {mae:.4f}")
            
            print(f"\nEfficiency:")
            print(f"  • Evaluation Time: {results['evaluation_time']:.2f} seconds")
            print(f"  • Predictions Made: {results['num_predictions']}")


# ============================================================================
# VISUALIZATION (Optional - requires matplotlib)
# ============================================================================

def try_visualize(results):
    """Attempt to create visualizations if matplotlib is available"""
    try:
        import matplotlib.pyplot as plt
        
        fig, axes = plt.subplots(2, 2, figsize=(12, 10))
        
        # RMSE Comparison
        models = list(results.keys())
        rmse_values = [results[m]['RMSE'] for m in models]
        axes[0, 0].bar(models, rmse_values, color='skyblue')
        axes[0, 0].set_title('RMSE Comparison (lower is better)')
        axes[0, 0].set_ylabel('RMSE')
        
        # MAE Comparison
        mae_values = [results[m]['MAE'] for m in models]
        axes[0, 1].bar(models, mae_values, color='lightcoral')
        axes[0, 1].set_title('MAE Comparison (lower is better)')
        axes[0, 1].set_ylabel('MAE')
        
        # User Correlation
        corr_values = [results[m]['user_correlation_mean'] for m in models]
        axes[1, 0].bar(models, corr_values, color='lightgreen')
        axes[1, 0].set_title('User Correlation (higher is better)')
        axes[1, 0].set_ylabel('Correlation')
        
        # Evaluation Time
        time_values = [results[m]['evaluation_time'] for m in models]
        axes[1, 1].bar(models, time_values, color='gold')
        axes[1, 1].set_title('Evaluation Time (lower is better)')
        axes[1, 1].set_ylabel('Seconds')
        
        plt.tight_layout()
        plt.savefig('evaluation_results.png', dpi=150)
        print("\n✓ Visualization saved as 'evaluation_results.png'")
        
    except ImportError:
        print("\n  (Install matplotlib for visualizations)")


# ============================================================================
# MAIN EXECUTION
# ============================================================================

def main():
    parser = argparse.ArgumentParser(description="Test Recommender Systems")
    parser.add_argument("--data-file", default="movielens_combined.csv", 
                       help="Combined CSV file with train/test split")
    parser.add_argument("--models", default="simple,mf,wizan,ensemble",
                       help="Comma-separated models to test")
    parser.add_argument("--test-size", type=float, default=0.2,
                       help="Test split ratio (if data doesn't have split column)")
    parser.add_argument("--output", default="evaluation_results.json",
                       help="Output file for results")
    
    args = parser.parse_args()
    
    print("="*80)
    print("RECOMMENDER SYSTEM TESTING FRAMEWORK")
    print("="*80)
    
    # Load data
    print(f"\nLoading data from {args.data_file}...")
    data = pd.read_csv(args.data_file)
    
    # Handle genres list if present
    if 'genres_list' in data.columns:
        data['genres_list'] = data['genres_list'].apply(eval)
    
    # Split data
    if 'split' in data.columns:
        train_data = data[data['split'] == 'train']
        test_data = data[data['split'] == 'test']
        print(f"Using pre-split data: {len(train_data)} train, {len(test_data)} test")
    else:
        # Random split if no split column
        from sklearn.model_selection import train_test_split
        train_data, test_data = train_test_split(data, test_size=args.test_size, random_state=42)
        print(f"Random split: {len(train_data)} train, {len(test_data)} test")
    
    # Initialize models
    models_to_test = args.models.split(',')
    models = {}
    
    print("\nInitializing models...")
    
    if 'simple' in models_to_test:
        print("  Building Simple Recommender...")
        models['Simple'] = SimpleRecommenderTest(train_data)
    
    if 'mf' in models_to_test:
        print("  Building Matrix Factorization...")
        models['Matrix Factorization'] = MatrixFactorizationTest(train_data)
    
    if 'wizan' in models_to_test:
        print("  Building wiZAN-Dual...")
        models['wiZAN-Dual'] = WizanTest(train_data)
    
    if 'ensemble' in models_to_test and len(models) > 1:
        print("  Building Ensemble (average of all models)...")
        models['Ensemble'] = EnsembleRecommenderTest(list(models.values()))
    
    # Evaluate
    evaluator = RecommenderEvaluator(train_data, test_data)
    results = evaluator.compare_models(models)
    
    # Save results
    # Convert numpy types to Python types for JSON
    serializable_results = {}
    for model, metrics in results.items():
        serializable_results[model] = {}
        for key, value in metrics.items():
            if isinstance(value, dict):
                serializable_results[model][key] = value
            elif isinstance(value, np.floating):
                serializable_results[model][key] = float(value)
            elif isinstance(value, np.integer):
                serializable_results[model][key] = int(value)
            else:
                serializable_results[model][key] = value
    
    with open(args.output, 'w') as f:
        json.dump(serializable_results, f, indent=2)
    print(f"\n✓ Results saved to {args.output}")
    
    # Try to create visualization
    try_visualize(results)
    
    # Summary
    print("\n" + "="*80)
    print("TESTING COMPLETE")
    print("="*80)
    print("\nKey Findings:")
    
    # Find best model by RMSE
    best_model = min(results.items(), key=lambda x: x[1]['RMSE'])
    print(f"  • Best performing model: {best_model[0]} (RMSE: {best_model[1]['RMSE']:.4f})")
    
    # Check if ensemble is better than individual
    if 'Ensemble' in results and len(models) > 1:
        individual_models = [m for m in results.keys() if m != 'Ensemble']
        avg_individual_rmse = np.mean([results[m]['RMSE'] for m in individual_models])
        ensemble_rmse = results['Ensemble']['RMSE']
        
        if ensemble_rmse < avg_individual_rmse:
            improvement = (avg_individual_rmse - ensemble_rmse) / avg_individual_rmse * 100
            print(f"  • Ensemble improves over individual models by {improvement:.1f}%")
        else:
            print(f"  • Ensemble performs similarly to individual models")


if __name__ == "__main__":
    main()