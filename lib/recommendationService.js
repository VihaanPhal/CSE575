import { cache } from "react";
import {
  GENRE_NAMES,
  getGenreStats,
  getMovieRatingDistribution,
  getMovieRatingTrend,
  getRatingDistribution,
  getRatingsOverTime,
  getRecommendations,
  getSimilarMovies,
  getStats,
  getTopMovies,
  getUserGenreProfile,
  getUserRatingDistribution,
  movieMap,
  searchByTitle,
  tagMap,
  userMap,
} from "@/lib/loadMovies";
import { ApiError } from "@/lib/api";
import { getPosterUrl } from "@/lib/posters";
import { getBenchmarks, runRecommendationBridge } from "@/lib/pythonBridge";

export const SUPPORTED_MODELS = ["content", "simple", "mf", "wizan", "ensemble"];

const MODEL_META = {
  content: {
    label: "Content",
    description: "Genre-vector similarity blended with crowd quality.",
  },
  simple: {
    label: "Explained Simple",
    description: "Weighted blend of genre affinity and rating quality.",
  },
  mf: {
    label: "Matrix Factorization",
    description: "Latent-factor recommendations from historical ratings.",
  },
  wizan: {
    label: "wiZAN",
    description: "One-class collaborative filtering with user/item graphs.",
  },
  ensemble: {
    label: "Ensemble",
    description: "Rank-fused shortlist across the main model families.",
  },
};

function round(value, precision = 3) {
  return Number.parseFloat(Number(value).toFixed(precision));
}

function getMovieGenres(movieId, fallbackGenres = "") {
  const movie = movieMap.get(movieId);
  return fallbackGenres || movie?.genres || "";
}

function getMovieTmdbId(movieId) {
  return movieMap.get(movieId)?.tmdbId ?? null;
}

function buildReasonBadges(model, recommendation, userGenres = []) {
  const badges = [];

  if (recommendation.averageRating) {
    badges.push(`${round(recommendation.averageRating, 2)} avg rating`);
  }
  if (recommendation.similarity) {
    badges.push(`${Math.round(recommendation.similarity * 100)}% genre match`);
  }
  if (recommendation.support) {
    badges.push(`${recommendation.support} ratings`);
  }
  if (recommendation.predictedRating) {
    badges.push(`Predicted ${round(recommendation.predictedRating, 2)}`);
  }

  const sharedGenres = getMovieGenres(recommendation.movieId || recommendation.movie_id, recommendation.genres)
    .split("|")
    .filter(Boolean)
    .filter((genre) => userGenres.includes(genre))
    .slice(0, 2);

  if (sharedGenres.length > 0 && model !== "mf" && model !== "ensemble") {
    badges.push(`Matches ${sharedGenres.join(" + ")}`);
  }

  if (model === "ensemble" && recommendation.sourceModels?.length) {
    badges.push(`${recommendation.sourceModels.length} models agree`);
  }

  return badges.slice(0, 3);
}

function normalizeRecommendation(model, recommendation, userGenres = []) {
  const movieId = Number(recommendation.movieId ?? recommendation.movie_id);
  const title = recommendation.title || movieMap.get(movieId)?.title || `Movie ${movieId}`;
  const genres = getMovieGenres(movieId, recommendation.genres);
  const averageRating =
    recommendation.averageRating !== undefined
      ? round(recommendation.averageRating, 2)
      : movieMap.has(movieId) && movieMap.get(movieId).ratings.length > 0
      ? round(
          movieMap.get(movieId).ratings.reduce((sum, row) => sum + row.rating, 0) /
            movieMap.get(movieId).ratings.length,
          2
        )
      : undefined;

  return {
    movieId,
    title,
    genres,
    genresList: genres ? genres.split("|").filter(Boolean) : [],
    tmdbId: recommendation.tmdbId ?? getMovieTmdbId(movieId),
    posterUrl: recommendation.posterUrl ?? null,
    model,
    score: round(recommendation.score ?? recommendation.predicted_rating ?? 0, 4),
    predictedRating:
      recommendation.predicted_rating !== undefined || recommendation.predictedRating !== undefined
        ? round(recommendation.predicted_rating ?? recommendation.predictedRating, 4)
        : undefined,
    averageRating,
    similarity:
      recommendation.similarity !== undefined ? round(recommendation.similarity, 4) : undefined,
    support: recommendation.support ?? recommendation.totalRatings ?? undefined,
    rank: recommendation.rank,
    sourceModels: recommendation.source_models ?? recommendation.sourceModels ?? [],
    individualRanks: recommendation.individual_ranks ?? recommendation.individualRanks ?? {},
    explanation: recommendation.explanation ?? null,
    reasonBadges: buildReasonBadges(model, { ...recommendation, movieId, genres, averageRating }, userGenres),
  };
}

async function attachPosterToRecommendation(recommendation) {
  if (!recommendation) return recommendation;
  const posterUrl =
    recommendation.posterUrl ?? (await getPosterUrl(recommendation.tmdbId ?? getMovieTmdbId(recommendation.movieId)));
  return {
    ...recommendation,
    posterUrl,
  };
}

async function attachPosters(recommendations) {
  return Promise.all(recommendations.map((recommendation) => attachPosterToRecommendation(recommendation)));
}

function ensureUser(userId) {
  if (!userMap.has(userId)) {
    throw new ApiError(404, "USER_NOT_FOUND", `No user found with ID '${userId}'.`);
  }
}

function ensureMovie(movieId) {
  if (!movieMap.has(movieId)) {
    throw new ApiError(404, "MOVIE_NOT_FOUND", `No movie found with ID '${movieId}'.`);
  }
}

export function getModelMeta() {
  return MODEL_META;
}

export const getLandingData = cache(async function getLandingData() {
  const stats = getStats();
  const popular = getTopMovies("popular", 6, 30).map((movie) =>
    normalizeRecommendation("content", movie)
  );
  const hiddenGems = getTopMovies("hidden_gem", 6, 20).map((movie) =>
    normalizeRecommendation("content", movie)
  );
  const sampleUsers = [...userMap.entries()]
    .toSorted((a, b) => b[1].length - a[1].length)
    .slice(0, 6)
    .map(([userId, ratings]) => ({
      userId,
      totalRatings: ratings.length,
      averageRating: round(ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length, 2),
    }));
  const [popularWithPosters, hiddenGemsWithPosters] = await Promise.all([
    attachPosters(popular),
    attachPosters(hiddenGems),
  ]);

  return {
    stats,
    popular: popularWithPosters,
    hiddenGems: hiddenGemsWithPosters,
    sampleUsers,
    topGenres: getGenreStats().slice(0, 8),
  };
});

export async function searchTitles(query, limit = 10) {
  return attachPosters(
    searchByTitle(query, limit).map((movie) => normalizeRecommendation("content", movie))
  );
}

export const getMovieDetail = cache(async function getMovieDetail(movieId) {
  ensureMovie(movieId);
  const movie = movieMap.get(movieId);
  const tags = (tagMap.get(movieId) || []).map((entry) => entry.tag);
  const uniqueTags = [...new Set(tags)];
  const averageRating = movie.ratings.length
    ? round(movie.ratings.reduce((sum, row) => sum + row.rating, 0) / movie.ratings.length, 2)
    : 0;

  const similarMovies = await attachPosters(
    getSimilarMovies(movieId, 12).map((entry) =>
      normalizeRecommendation("content", { ...entry, movieId: entry.movieId })
    )
  );

  return {
    movieId,
    title: movie.title,
    genres: movie.genres,
    genresList: movie.genres.split("|").filter(Boolean),
    totalRatings: movie.ratings.length,
    averageRating,
    imdbId: movie.imdbId,
    tmdbId: movie.tmdbId,
    posterUrl: await getPosterUrl(movie.tmdbId),
    tags: uniqueTags,
    ratings: [...movie.ratings].toSorted((a, b) => b.timestamp - a.timestamp),
    ratingDistribution: getMovieRatingDistribution(movieId),
    ratingTrend: getMovieRatingTrend(movieId),
    similarMovies,
  };
});

export const getDiscoverPayload = cache(async function getDiscoverPayload(options = {}) {
  const sortBy = options.sortBy || "rating";
  const limit = options.limit || 24;
  const minRatings = options.minRatings || 20;
  const genre = options.genre || null;
  const similarTo = options.similarTo || null;

  if (similarTo) {
    const movie = await getMovieDetail(similarTo);
    return {
      mode: "similar",
      sortBy,
      minRatings,
      limit,
      genre,
      genres: GENRE_NAMES,
      baseMovie: { movieId: movie.movieId, title: movie.title, genres: movie.genres },
      movies: movie.similarMovies,
      totalResults: movie.similarMovies.length,
    };
  }

  const movies = await attachPosters(
    getTopMovies(sortBy, limit, minRatings, genre).map((entry) =>
      normalizeRecommendation("content", { ...entry, movieId: entry.movieId })
    )
  );

  return {
    mode: "discover",
    sortBy,
    minRatings,
    limit,
    genre,
    genres: GENRE_NAMES,
    movies,
    totalResults: movies.length,
  };
});

export function getUserSummary(userId) {
  ensureUser(userId);
  const ratings = userMap.get(userId);
  const averageRating = round(ratings.reduce((sum, row) => sum + row.rating, 0) / ratings.length, 2);
  const genreProfile = getUserGenreProfile(userId);
  const dominantGenres = genreProfile.slice(0, 3).map((entry) => entry.genre);

  return {
    user: {
      userId,
      totalRatings: ratings.length,
      averageRating,
      dominantGenres,
    },
    history: [...ratings].toSorted((a, b) => b.timestamp - a.timestamp),
    profile: {
      genreProfile,
      ratingDistribution: getUserRatingDistribution(userId),
    },
  };
}

export async function getModelRecommendations(userId, options = {}) {
  ensureUser(userId);
  const model = options.model || "content";
  const limit = options.limit || 12;
  const userGenres = getUserGenreProfile(userId)
    .slice(0, 5)
    .map((entry) => entry.genre);

  if (model === "content") {
    return attachPosters(
      getRecommendations(userId, limit).map((entry) =>
        normalizeRecommendation("content", { ...entry, movieId: entry.movieId }, userGenres)
      )
    );
  }

  const payload = await runRecommendationBridge([
    "model",
    "--model",
    model,
    "--user-id",
    String(userId),
    "--top-n",
    String(limit),
  ]);

  return attachPosters(
    (payload.recommendations || []).map((entry) => normalizeRecommendation(model, entry, userGenres))
  );
}

export async function getUserComparison(userId, limit = 6) {
  ensureUser(userId);

  const pythonComparison = await runRecommendationBridge([
    "compare",
    "--user-id",
    String(userId),
    "--top-n",
    String(limit),
  ]);

  const userGenres = getUserGenreProfile(userId)
    .slice(0, 5)
    .map((entry) => entry.genre);

  const models = {
    content: await attachPosters(
      getRecommendations(userId, limit).map((entry) =>
        normalizeRecommendation("content", { ...entry, movieId: entry.movieId }, userGenres)
      )
    ),
  };

  for (const [modelName, rows] of Object.entries(pythonComparison.models || {})) {
    models[modelName] = await attachPosters(
      rows.map((entry) => normalizeRecommendation(modelName, entry, userGenres))
    );
  }

  return {
    models,
    overlap: (pythonComparison.overlap || []).map((entry) => ({
      movieId: entry.movie_id,
      title: entry.title,
      models: entry.models,
    })),
  };
}

export async function getUserWorkspace(userId, options = {}) {
  const summary = getUserSummary(userId);
  const requestedModel = options.model || "content";
  let activeModel = requestedModel;
  let bridgeWarning = null;
  let recommendations;

  try {
    recommendations = await getModelRecommendations(userId, {
      model: requestedModel,
      limit: options.limit || 12,
    });
  } catch (error) {
    activeModel = "content";
    bridgeWarning = error.message;
    recommendations = await getModelRecommendations(userId, {
      model: "content",
      limit: options.limit || 12,
    });
  }

  return {
    ...summary,
    requestedModel,
    activeModel,
    recommendations,
    bridgeWarning,
    modelCatalog: Object.entries(MODEL_META).map(([key, value]) => ({
      key,
      ...value,
    })),
  };
}

export async function getInterviewMovies(count = 12) {
  const payload = await runRecommendationBridge([
    "interview",
    "--count",
    String(count),
  ]);
  return Promise.all(
    (payload.interview_movies || []).map(async (movie) => ({
      ...movie,
      posterUrl: await getPosterUrl(movie.tmdbId ?? getMovieTmdbId(movie.movieId)),
    }))
  );
}

export async function getColdStartRecommendations(ratings, limit = 12) {
  const payload = await runRecommendationBridge([
    "coldstart",
    "--top-n",
    String(limit),
    "--ratings",
    JSON.stringify(ratings),
  ]);

  return attachPosters(
    (payload.recommendations || []).map((entry) =>
      normalizeRecommendation("wizan", entry)
    )
  );
}

export async function getAnalyticsPayload() {
  const stats = getStats();
  const genreStats = getGenreStats();
  const ratingDistribution = getRatingDistribution();
  const ratingsOverTime = getRatingsOverTime();
  let benchmarks;

  try {
    benchmarks = await getBenchmarks();
  } catch (error) {
    benchmarks = {
      metrics: {},
      suspicious: false,
      error: error.message,
    };
  }

  return {
    stats,
    genreStats,
    ratingDistribution,
    ratingsOverTime,
    benchmarks,
  };
}
