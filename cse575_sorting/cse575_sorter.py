import pandas as pd
import numpy as np
from sklearn.model_selection import GroupShuffleSplit

# Load data from ratings.csv and movies.csv, this will change if you use a different file. Put files in same location
ratings_df = pd.read_csv('ratings.csv')
movies_df = pd.read_csv('movies.csv')

# Process the genres 
movies_df['genres_list'] = movies_df['genres'].str.split('|')
all_genres = set()
for genres in movies_df['genres_list']:
    all_genres.update(genres)
all_genres.discard('(no genres listed)')
sorted_genres = sorted(all_genres)
for genre in sorted_genres:
    movies_df[f'genre_{genre}'] = movies_df['genres'].str.contains(genre).astype(int)

# Filter sparse users and items*
# We do this now to make the data a bit more accurate, but this will probably be changed later and replaced with something more sophisticated
# not exactly sure what but this block is semi-temporary
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

# Create train/test split
splitter = GroupShuffleSplit(n_splits=1, test_size=0.2, random_state=42)
train_idx, test_idx = next(splitter.split(ratings_df, groups=ratings_df['userId']))
train_df = ratings_df.iloc[train_idx]
test_df = ratings_df.iloc[test_idx]

# Merge movie information into one file
movie_columns = ['movieId', 'title', 'genres', 'genres_list'] + [f'genre_{g}' for g in sorted_genres]
movies_subset = movies_df[movie_columns].copy()
train_merged = train_df.merge(movies_subset, on='movieId', how='left')
test_merged = test_df.merge(movies_subset, on='movieId', how='left')

# Combine with split indicator
train_merged['split'] = 'train'
test_merged['split'] = 'test'
final_df = pd.concat([train_merged, test_merged], ignore_index=True)

# Define column order so the completed file is made how we want it. If yo want to change the order of columns later, here is where to do it
column_order = [
    'userId', 'user_idx', 
    'movieId', 'movie_idx',
    'rating', 'timestamp', 'datetime',
    'title', 'genres', 'genres_list'
] + [f'genre_{g}' for g in sorted_genres] + ['split']

# This takes the timestamp which is hard to read for a human and makes a new column that is easily readable
# i.e. it turns 964982703 into 2000-07-30 18:45:03 so we have both for reading the data
# if we don't need the human readable timestamp then you can comment this out.
final_df['datetime'] = pd.to_datetime(final_df['timestamp'], unit='s')

# THIS IS A BACKUP MEASURE TO MAKE SURE AT LEAST ALL GENRES APPEAR AT LEAST ONCE
# don't expect this section to do anything in the actual version, this just makes sure that each genre column exists even if no movies have that genre. 
# it will forcably assign 0 to all movies for that genre, which is ensures our data is all where it should be i.e. if columne 11 is not present then 12+ are all one space to the left, this avoids that
for col in column_order:
    if col.startswith('genre_') and col not in final_df.columns:
        final_df[col] = 0

# Reorder columns and save to the file
final_df = final_df[column_order]
final_df.to_csv('movielens_combined.csv', index=False)