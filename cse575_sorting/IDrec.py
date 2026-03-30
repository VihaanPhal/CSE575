import pandas as pd
import numpy as np

class SimpleRecommender:
    """
    A simple movie recommender system that suggests movies based on user's information from the cleaned CSV file, will add another file later don't worry about it.
    """
    
    def __init__(self, data_file='movielens_combined.csv'):
        """
        Load and processes the movie data from the CSV file
        
        Args: Takes the cleaned dataset, will probably take another file of precomputed data as well in the future.
        That is just to speed it up so don't worry about it now. 
        """
        # Load the dataset
        self.data = pd.read_csv(data_file)
        
        # Convert string representation of genre lists to python lists to make it readable
        self.data['genres_list'] = self.data['genres_list'].apply(eval)
        
        # My CSV has data labelled as 'train' and 'test', we will only use the training data to build our user profiles and movie statistics
        # data labeled 'test' is only used for testing so this will filter it out, in future might make train and test 2 different files to skip this step if that makes it run faster
        self.train_data = self.data[self.data['split'] == 'train']
        
        # Calculate movie statistics based off average rating and # or ratings
        self.movie_stats = {}
        for movie_id, group in self.train_data.groupby('movieId'):
            first = group.iloc[0]  # First row contains movie metadata
            self.movie_stats[movie_id] = {
                'title': first['title'],
                'genres_list': first['genres_list'],
                'avg_rating': group['rating'].mean(),
                'count': len(group)
            }
        
        # Build user profiles based on their rating history, this will probably be done pre-run later with contents put in a separate file to speed it up but for now this is fine
        self.user_profiles = {}
        for user_id in self.train_data['userId'].unique():
            # Get all ratings for this user
            user_data = self.train_data[self.train_data['userId'] == user_id]
            rated = set()  # Set of movie IDs the user has rated
            rated_movies_details = []  # NEW: Store detailed info about rated movies
            genre_prefs = {}  # Dictionary to accumulate genre preferences
            
            # Process each movie the user rated
            for _, row in user_data.iterrows():
                movie_id = row['movieId']
                if movie_id in self.movie_stats:
                    rated.add(movie_id)
                    
                    # NEW: Store detailed information for debug output
                    rated_movies_details.append({
                        'movie_id': movie_id,
                        'title': self.movie_stats[movie_id]['title'],
                        'rating': row['rating'],
                        'genres': self.movie_stats[movie_id]['genres_list']
                    })
                    
                    # Add rating to each genre of the movie
                    for genre in self.movie_stats[movie_id]['genres_list']:
                        genre_prefs[genre] = genre_prefs.get(genre, 0) + row['rating']
            
            # Normalize genre preferences to range [0,1]
            # Basically this calculates the average rating of movies within a genre so if user watched 
            # Movie A (Action, Comedy) Rated 5 stars
            # Movie B (Action, Drama) Rated 3 stars
            # Movie C(Comedy) Rated 2 stars
            # then we get:
            # Action = 5+3=8
            # Comedy = 5+2=7
            # Drama = 3
            # so Action becomes 8/8(8 being highest genre score) Comedy = 7/8 and Drama = 3/8. This is how we find user preference for genre
            if genre_prefs:
                max_pref = max(genre_prefs.values())
                normalized_prefs = {g: s/max_pref for g, s in genre_prefs.items()}
            else:
                normalized_prefs = {}
                
            self.user_profiles[user_id] = {
                'rated': rated,
                'rated_movies_details': rated_movies_details,  # NEW: Store detailed rated movies
                'genre_prefs': normalized_prefs
            }
    
    def print_user_info(self, user_id):
        """
        function to print detailed information about the user

        Args: takes user_id to find to find the user and display information about them
        """
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
            # Truncate title to 50 chars, format rating with 1 decimal, join genres with commas
            title_display = movie['title'][:47] + "..." if len(movie['title']) > 50 else movie['title']
            genres_display = ', '.join(movie['genres'][:3])  # Show first 3 genres for brevity
            if len(movie['genres']) > 3:
                genres_display += f" (+{len(movie['genres'])-3} more)"
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
        Main function that actually generates the recommendations for a given user
        
        Args:
            user_id (int): ID of the user to generate recommendations for
            n (int): Number of recommendations to return, we use 10 for now, but final project will probably use more
            
        Returns:
            list: List of tuples containing (movie_id, title, score) for top n movies
        """
        # Check if user exists
        if user_id not in self.user_profiles:
            return []
        
        #set the user and create the emply list which will be filled with tuples
        user = self.user_profiles[user_id]
        scores = []  # Will store tuples of (movie_id, title, score, breakdown)
        
        # Score each movie the user hasn't seen
        for movie_id, stats in self.movie_stats.items():
            # Skip movies the user has already rated
            if movie_id in user['rated']:
                continue
            
            # Calculate a rating score based on how a movie is rated normalized to [0,1]
            rating_score = stats['avg_rating'] / 5.0
            
            # Genre score: how well the movie's genres match user preferences
            genre_score = 0
            genre_match_details = {}
            if user['genre_prefs']:
                # Calculate match for each genre
                for genre in stats['genres_list']:
                    match = user['genre_prefs'].get(genre, 0)
                    genre_match_details[genre] = match
                matches = sum(genre_match_details.values())
                genre_score = matches / max(1, len(stats['genres_list']))
            
            # Weighted combination: 40% rating, 60% genre match, this amount is arbitrary and can be changed later as we like
            rating_weight = 0.4
            genre_weight = 0.6
            score = rating_weight * rating_score + genre_weight * genre_score
            
            # Store score breakdown for debug output
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
        
        # Return top n with full breakdown
        return scores[:n]
    
    def print_rec_debug_info(self, user_id, recommendations):
        """
        Print recommendations debug infor
        """
        print(f"\nTOP {len(recommendations)} RECOMMENDATIONS FOR USER {user_id}:")
        print("="*80)
        
        for i, (movie_id, title, total_score, breakdown) in enumerate(recommendations, 1):
            print(f"\n{i}. {title}")
            print(f"Total Score: {total_score:.4f}")
            print("-"*80)
            
            # Show rating contribution
            print(f"RATING FACTOR (weight: {breakdown['rating_weight']:.0%}):")
            print(f"Movie average rating: {breakdown['avg_rating']:.2f}/5.0")
            print(f"Normalized rating score: {breakdown['rating_score']:.4f}")
            print(f"Contribution to total: {breakdown['rating_contribution']:.4f}")
            
            # Show genre contribution
            print(f"\nGENRE FACTOR (weight: {breakdown['genre_weight']:.0%}):")
            if breakdown['genre_matches']:
                print(f"Genre matches:")
                for genre, match in breakdown['genre_matches'].items():
                    print(f"- {genre}: {match:.3f}")
                print(f"Total matches sum: {sum(breakdown['genre_matches'].values()):.3f}")
                print(f"Number of genres in movie: {len(breakdown['genre_matches'])}")
                print(f"Normalized genre score: {breakdown['genre_score']:.4f}")
            else:
                print(f"No genre preferences available")
                print(f"Genre score: {breakdown['genre_score']:.4f}")
            print(f"Contribution to total: {breakdown['genre_contribution']:.4f}")
            
            # Show final calculation
            print(f"\nFINAL CALCULATION:")
            print(f"({breakdown['rating_weight']:.1f} × {breakdown['rating_score']:.4f}) + ({breakdown['genre_weight']:.1f} × {breakdown['genre_score']:.4f})")
            print(f"= {breakdown['rating_contribution']:.4f} + {breakdown['genre_contribution']:.4f}")
            print(f"= {total_score:.4f}")
            
            # Show additional movie info
            print(f"\nMOVIE INFO:")
            print(f"Total ratings: {breakdown['rating_count']}")
            print(f"Average score: {breakdown['avg_rating']}")
            print(f"Genres: {', '.join(self.movie_stats[movie_id]['genres_list'])}")
            
        print("\n" + "="*100)


# main lol
if __name__ == "__main__":
    # Initialize the recommender system with the data file
    rec = SimpleRecommender('movielens_combined.csv')
    
    # Ask for user ID which will be used and display usable ID's(except for those in 'test' split)
    # NOTE: user ID's in CSV are separated into userID and user_idx, userID is pulled from the unprocessed data file, and is a unique identifier for
    # each user which increases from 1 and does not increase sequencitally, current file userIDs are 1, 2, 4... some are skipped,
    # user_idx is a new column we made which is sequential starting from 0, can be used, but still has issue of some ID's being in 'test' split so we just use userID
    # if you want to check a specific user, look for their ID first in movielens_combined.csv, current iteration says "Available user IDs range from 1 to 610" but not all of 
    # these ID's actually exist so picking a number at random within the range might throw and exception.
    print(f"Available user IDs range from {min(rec.user_profiles.keys())} to {max(rec.user_profiles.keys())}*(not all IDs in this range are valid so picking randomly might throw an exception)")
    user_input = input("Enter user ID: ").strip()
    
    # Generate and display recommendations if user ID is valid
    try:
        user_id = int(user_input)
        #print the user info 
        # IF *USER* DEBUG INFORMATION IS TOO MUCH/TOO LONGCOMMENT OUT THE THIS LINE
        rec.print_user_info(user_id)
        # THIS ONE
        recommendations = rec.recommend(user_id)
        
        if recommendations:
            # Print recommendations with detailed debug info
            rec.print_rec_debug_info(user_id, recommendations)
        else:
            print(f"No recommendations found for user {user_id}")
            
    except ValueError:
        print(f"Invalid input: '{user_input}' is not a valid user ID")