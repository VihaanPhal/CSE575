import pandas as pd
import numpy as np
import ast

class SimpleRecommender:
    """
    A simple movie recommender system that suggests movies based on user's information from the cleaned CSV file.
    Now loads precomputed user profiles and movie statistics for faster startup.
    """
    
    def __init__(self, movie_stats_file='movie_stats.csv', user_profiles_file='user_profiles.csv', data_file='movielens_combined.csv'):
        """
        Load precomputed movie statistics and user profiles
        """
        # Load precomputed movie statistics
        movie_stats_df = pd.read_csv(movie_stats_file)
        
        self.movie_stats = {}
        for _, row in movie_stats_df.iterrows():
            # Parse genres_list from string to list if needed
            if isinstance(row['genres_list'], str):
                genres_list = ast.literal_eval(row['genres_list'])
            else:
                genres_list = row['genres_list']
            
            self.movie_stats[row['movie_id']] = {
                'title': row['title'],
                'genres_list': genres_list,
                'avg_rating': row['avg_rating'],
                'count': row['rating_count']
            }
        
        # Load precomputed user profiles
        user_profiles_df = pd.read_csv(user_profiles_file)
        
        self.user_profiles = {}
        for _, row in user_profiles_df.iterrows():
            # Parse the stored data back to Python objects
            rated_movie_ids = ast.literal_eval(row['rated_movie_ids']) if isinstance(row['rated_movie_ids'], str) else row['rated_movie_ids']
            rated_movies_details = ast.literal_eval(row['rated_movies_details']) if isinstance(row['rated_movies_details'], str) else row['rated_movies_details']
            genre_prefs = ast.literal_eval(row['genre_prefs']) if isinstance(row['genre_prefs'], str) else row['genre_prefs']
            
            # Convert rated_movie_ids from list to set for faster lookup
            self.user_profiles[row['user_id']] = {
                'rated': set(rated_movie_ids),
                'rated_movies_details': rated_movies_details,
                'genre_prefs': genre_prefs,
                'num_ratings': row['num_ratings']
            }
    
    def print_user_info(self, user_id):
        """
        Print detailed information about the user
        """
        if user_id not in self.user_profiles:
            print(f"User {user_id} not found!")
            return
            
        user = self.user_profiles[user_id]
        
        print("\n" + "="*80)
        print(f"USER {user_id} DEBUG INFORMATION")
        print("="*80)
        
        # Show user's rated movies
        print(f"\nMOVIES RATED BY USER {user_id}:")
        print("-"*80)
        print(f"{'Title':50} {'Rating':6} {'Genres'}")
        print("-"*80)
        
        # Sort rated movies by rating (highest first)
        sorted_movies = sorted(user['rated_movies_details'], 
                              key=lambda x: x['rating'], reverse=True)
        
        for movie in sorted_movies:
            # Truncate title to 50 chars
            title_display = movie['title'][:47] + "..." if len(movie['title']) > 50 else movie['title']
            
            # Get genres from the stored list
            if 'genres_list' in movie:
                genres_data = movie['genres_list']
            else:
                genres_data = []
            
            # Display first 3 genres
            if isinstance(genres_data, list) and genres_data:
                genres_display = ', '.join(genres_data[:10])
                if len(genres_data) > 10:
                    genres_display += f" (+{len(genres_data)-10} more)"
            else:
                genres_display = "*MOVIE HAS NO GENRE LISTED CHECK MOVIE ID IN DATABASE*"
            
            print(f"{title_display:50} {movie['rating']:6.1f}  {genres_display}")
        
        # Show genre preferences
        print(f"\nGENRE PREFERENCES (normalized to [0,1]):")
        print("-"*80)
        if user['genre_prefs']:
            sorted_genres = sorted(user['genre_prefs'].items(), 
                                  key=lambda x: x[1], reverse=True)
            for genre, pref in sorted_genres:
                print(f"  {genre:20} {pref:.3f}")
        else:
            print("  No genre preferences found")
        print("="*80 + "\n")
    
    def recommend(self, user_id, n=10):
        """
        Generate recommendations for a given user
        """
        # Check if user exists
        if user_id not in self.user_profiles:
            return []
        
        user = self.user_profiles[user_id]
        scores = []
        
        # Score each movie the user hasn't seen
        for movie_id, stats in self.movie_stats.items():
            # Skip movies the user has already rated
            if movie_id in user['rated']:
                continue
            
            # Rating score normalized to [0,1]
            rating_score = stats['avg_rating'] / 5.0
            
            # Genre score
            genre_score = 0
            genre_match_details = {}
            if user['genre_prefs']:
                for genre in stats['genres_list']:
                    match = user['genre_prefs'].get(genre, 0)
                    genre_match_details[genre] = match
                matches = sum(genre_match_details.values())
                genre_score = matches / max(1, len(stats['genres_list']))
            
            # Weighted combination: 40% rating, 60% genre match
            rating_weight = 0.4
            genre_weight = 0.6
            score = rating_weight * rating_score + genre_weight * genre_score
            
            # Store breakdown
            breakdown = {
                'rating_score': rating_score,
                'rating_weight': rating_weight,
                'rating_contribution': rating_weight * rating_score,
                'genre_score': genre_score,
                'genre_weight': genre_weight,
                'genre_contribution': genre_weight * genre_score,
                'genre_matches': genre_match_details,
                'avg_rating': stats['avg_rating'],
                'rating_count': stats['count']
            }
            
            scores.append((movie_id, stats['title'], score, breakdown))
        
        # Sort by score descending
        scores.sort(key=lambda x: x[2], reverse=True)
        return scores[:n]
    
    def print_rec_debug_info(self, user_id, recommendations):
        """
        Print recommendations with debug information
        """
        print(f"\nTOP {len(recommendations)} RECOMMENDATIONS FOR USER {user_id}:")
        print("="*80)
        
        for i, (movie_id, title, total_score, breakdown) in enumerate(recommendations, 1):
            print(f"\n{i}. {title}")
            print(f"   Total Score: {total_score:.4f}")
            print("-"*80)
            
            # Rating contribution
            print(f"   RATING FACTOR (weight: {breakdown['rating_weight']:.0%}):")
            print(f"      • Movie average rating: {breakdown['avg_rating']:.2f}/5.0")
            print(f"      • Normalized rating score: {breakdown['rating_score']:.4f}")
            print(f"      • Contribution: {breakdown['rating_contribution']:.4f}")
            
            # Genre contribution
            print(f"\n   GENRE FACTOR (weight: {breakdown['genre_weight']:.0%}):")
            if breakdown['genre_matches']:
                print(f"      • Individual genre matches:")
                for genre, match in list(breakdown['genre_matches'].items())[:5]:  # Show first 5
                    print(f"        - {genre}: {match:.3f}")
                if len(breakdown['genre_matches']) > 5:
                    print(f"        ... and {len(breakdown['genre_matches'])-5} more")
                print(f"      • Total matches sum: {sum(breakdown['genre_matches'].values()):.3f}")
                print(f"      • Number of genres: {len(breakdown['genre_matches'])}")
                print(f"      • Normalized genre score: {breakdown['genre_score']:.4f}")
            else:
                print(f"      • No genre preferences available")
            print(f"      • Contribution: {breakdown['genre_contribution']:.4f}")
            
            # Final calculation
            print(f"\n   FINAL CALCULATION:")
            print(f"      ({breakdown['rating_weight']:.1f} × {breakdown['rating_score']:.4f}) + ({breakdown['genre_weight']:.1f} × {breakdown['genre_score']:.4f})")
            print(f"      = {breakdown['rating_contribution']:.4f} + {breakdown['genre_contribution']:.4f}")
            print(f"      = {total_score:.4f}")
            
            # Movie info
            print(f"\n   MOVIE INFO:")
            print(f"      • Total ratings: {breakdown['rating_count']}")
            print(f"      • Average rating: {breakdown['avg_rating']:.2f}")
            genres_str = ', '.join(self.movie_stats[movie_id]['genres_list'][:5])
            if len(self.movie_stats[movie_id]['genres_list']) > 5:
                genres_str += f" (+{len(self.movie_stats[movie_id]['genres_list'])-5} more)"
            print(f"      • Genres: {genres_str}")
            
        print("\n" + "="*80)


# Main execution
if __name__ == "__main__":
    # Initialize the recommender
    rec = SimpleRecommender('movie_stats.csv', 'user_profiles.csv', 'movielens_combined.csv')
    
    # Display available user range
    if rec.user_profiles:
        print(f"\nAvailable user IDs range from {min(rec.user_profiles.keys())} to {max(rec.user_profiles.keys())}")
        print("(Note: Not all IDs in this range are valid - only users from the training set)")
    else:
        print("\nNo user profiles loaded!")
        exit(1)
    
    # Get user input
    user_input = input("\nEnter user ID: ").strip()
    
    try:
        user_id = int(user_input)
        if user_id not in rec.user_profiles:
            print(f"\nUser {user_id} not found in training data!")
        else:
            # Display user info
            rec.print_user_info(user_id)
            
            # Get and display recommendations
            recommendations = rec.recommend(user_id)
            
            if recommendations:
                rec.print_rec_debug_info(user_id, recommendations)
            else:
                print(f"\nNo recommendations found for user {user_id}")
                
    except ValueError:
        print(f"\nInvalid input: '{user_input}' is not a valid user ID")
    except KeyboardInterrupt:
        print("\n\nExiting...")