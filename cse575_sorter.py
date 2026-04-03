import pandas as pd
import numpy as np
from sklearn.model_selection import GroupShuffleSplit

# Load data
ratings_df = pd.read_csv('ratings.csv')
movies_df = pd.read_csv('movies.csv')

# Process genres
movies_df['genres_list'] = movies_df['genres'].str.split('|')
all_genres = set()
for genres in movies_df['genres_list']:
    all_genres.update(genres)
all_genres.discard('(no genres listed)')
sorted_genres = sorted(all_genres)
for genre in sorted_genres:
    movies_df[f'genre_{genre}'] = movies_df['genres'].str.contains(genre).astype(int)

# Filter sparse users and items
min_user_ratings = 5
min_movie_ratings = 5
user_counts = ratings_df['userId'].value_counts()
users_to_keep = user_counts[user_counts >= min_user_ratings].index
ratings_df = ratings_df[ratings_df['userId'].isin(users_to_keep)]
movie_counts = ratings_df['movieId'].value_counts()
movies_to_keep = movie_counts[movie_counts >= min_movie_ratings].index
ratings_df = ratings_df[ratings_df['movieId'].isin(movies_to_keep)]

# Create user and movie mappings
unique_users = ratings_df['userId'].unique()
unique_movies = ratings_df['movieId'].unique()
user_to_index = {user: i for i, user in enumerate(unique_users)}
movie_to_index = {movie: i for i, movie in enumerate(unique_movies)}
ratings_df['user_idx'] = ratings_df['userId'].map(user_to_index)
ratings_df['movie_idx'] = ratings_df['movieId'].map(movie_to_index)

# Create train/test split for later testing, test_size is 20 percent are test therefore 80% are train. If you dont want test data and only train data change test_size to 0
splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(splitter.split(ratings_df, groups=ratings_df['userId']))
train_df = ratings_df.iloc[train_idx]
test_df = ratings_df.iloc[test_idx]

# Merge movie information
movie_columns = ['movieId', 'title', 'genres', 'genres_list'] + [f'genre_{g}' for g in sorted_genres]
movies_subset = movies_df[movie_columns].copy()
train_merged = train_df.merge(movies_subset, on='movieId', how='left')
test_merged = test_df.merge(movies_subset, on='movieId', how='left')

# Combine with split indicator(most are train which are used to train the model and test is used to evaluate the model later)
train_merged['split'] = 'train'
test_merged['split'] = 'test'
final_df = pd.concat([train_merged, test_merged], ignore_index=True)

# Add datetime column
final_df['datetime'] = pd.to_datetime(final_df['timestamp'], unit='s')

# Define column order (This is not dynamic and only works for movielens, if we use another database we need to change this)
column_order = [
    'userId', 'user_idx', 
    'movieId', 'movie_idx',
    'rating', 'timestamp', 'datetime',
    'title', 'genres', 'genres_list'
] + [f'genre_{g}' for g in sorted_genres] + ['split']

# Ensure all genre columns exist(if the database doesn't include a genre we need to add it with 0 in all columns or we can have errors.)
# this shouldn't be an issue with larger databases, but I am being careful
for col in column_order:
    if col.startswith('genre_') and col not in final_df.columns:
        final_df[col] = 0

# Save movie information and ratings to CSV
final_df = final_df[column_order]
final_df.to_csv('movielens_combined.csv', index=False)

# Precompute movie statistics to save time when running IDrec.py
train_data_only = final_df[final_df['split'] == 'train']
movie_stats_list = []
for movie_id, group in train_data_only.groupby('movieId'):
    first = group.iloc[0]
    # Store genres_list as a proper list NOT as a sting to avoid issues later
    genres_list = first['genres_list']
    if isinstance(genres_list, str):
        genres_list = eval(genres_list)
    
    movie_stats_list.append({
        'movie_id': movie_id,
        'title': first['title'],
        'genres_list': genres_list,
        'avg_rating': group['rating'].mean(),
        'rating_count': len(group)
    })

movie_stats_df = pd.DataFrame(movie_stats_list)
movie_stats_df.to_csv('movie_stats.csv', index=False)

# Precompute user profiles to save time when running IDrec.py
user_profiles_list = []
for user_id in train_data_only['userId'].unique():
    user_data = train_data_only[train_data_only['userId'] == user_id]
    
    rated_movie_ids = []
    rated_movies_details = []
    genre_prefs = {}
    
    for _, row in user_data.iterrows():
        movie_id = row['movieId']
        # Find movie info from movie_stats_list
        movie_info = next((m for m in movie_stats_list if m['movie_id'] == movie_id), None)
        if movie_info:
            rated_movie_ids.append(movie_id)
            rated_movies_details.append({
                'movie_id': movie_id,
                'title': movie_info['title'],
                'rating': row['rating'],
                'genres_list': movie_info['genres_list']  # Store as list
            })
            
            for genre in movie_info['genres_list']:
                genre_prefs[genre] = genre_prefs.get(genre, 0) + row['rating']
    
    # Normalize genre preferences between [0,1] for computations
    if genre_prefs:
        max_pref = max(genre_prefs.values())
        normalized_prefs = {g: s/max_pref for g, s in genre_prefs.items()}
    else:
        normalized_prefs = {}
    
    user_profiles_list.append({
        'user_id': user_id,
        'rated_movie_ids': rated_movie_ids,
        'rated_movies_details': rated_movies_details,
        'genre_prefs': normalized_prefs,
        'num_ratings': len(rated_movies_details)
    })

user_profiles_df = pd.DataFrame(user_profiles_list)
user_profiles_df.to_csv('user_profiles.csv', index=False)