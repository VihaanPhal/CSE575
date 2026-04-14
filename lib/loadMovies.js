import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";

const sortingDir = join(process.cwd(), "cse575_sorting");
const csvPath = join(sortingDir, "movielens_combined.csv");
const tagsPath = join(sortingDir, "tags.csv");
const linksPath = join(sortingDir, "links.csv");

// All 19 genre columns from the combined CSV
const GENRE_COLUMNS = [
  "genre_Action", "genre_Adventure", "genre_Animation", "genre_Children",
  "genre_Comedy", "genre_Crime", "genre_Documentary", "genre_Drama",
  "genre_Fantasy", "genre_Film-Noir", "genre_Horror", "genre_IMAX",
  "genre_Musical", "genre_Mystery", "genre_Romance", "genre_Sci-Fi",
  "genre_Thriller", "genre_War", "genre_Western",
];

const GENRE_NAMES = GENRE_COLUMNS.map((c) => c.replace("genre_", ""));

let userMap = new Map();   // userId -> Array<{movieId, title, rating, genres, datetime, timestamp}>
let movieMap = new Map();  // movieId -> {title, genres, genreVector, ratings: [...], tags: [], imdbId, tmdbId}
let tagMap = new Map();    // movieId -> Array<{userId, tag, datetime}>
let linkMap = new Map();   // movieId -> {imdbId, tmdbId}
let titleIndex = [];       // Array<{movieId, titleLower, title}> for text search

// ── Load combined CSV ───────────────────────────────────────────────────────
try {
  const raw = readFileSync(csvPath, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true });

  for (const row of records) {
    const userId = parseInt(row.userId, 10);
    const movieId = parseInt(row.movieId, 10);
    const rating = parseFloat(row.rating);
    const title = row.title;
    const genres = row.genres;
    const datetime = row.datetime;
    const timestamp = parseInt(row.timestamp, 10);

    // Build genre vector (array of 0/1)
    const genreVector = GENRE_COLUMNS.map((col) => parseInt(row[col], 10) || 0);

    // Build userMap
    if (!userMap.has(userId)) {
      userMap.set(userId, []);
    }
    userMap.get(userId).push({ movieId, title, rating, genres, datetime, timestamp });

    // Build movieMap
    if (!movieMap.has(movieId)) {
      movieMap.set(movieId, {
        title,
        genres,
        genreVector,
        ratings: [],
        tags: [],
        imdbId: null,
        tmdbId: null,
      });
    }
    movieMap.get(movieId).ratings.push({ userId, rating, datetime, timestamp });
  }
} catch {
  // CSV not present — maps stay empty
}

// ── Load tags.csv ───────────────────────────────────────────────────────────
try {
  const raw = readFileSync(tagsPath, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true });

  for (const row of records) {
    const movieId = parseInt(row.movieId, 10);
    const userId = parseInt(row.userId, 10);
    const tag = row.tag;
    const timestamp = parseInt(row.timestamp, 10);
    const datetime = new Date(timestamp * 1000).toISOString().replace("T", " ").slice(0, 19);

    if (!tagMap.has(movieId)) {
      tagMap.set(movieId, []);
    }
    tagMap.get(movieId).push({ userId, tag, datetime });

    // Also attach to movieMap if available
    if (movieMap.has(movieId)) {
      movieMap.get(movieId).tags.push({ userId, tag, datetime });
    }
  }
} catch {
  // tags.csv not present
}

// ── Load links.csv ──────────────────────────────────────────────────────────
try {
  const raw = readFileSync(linksPath, "utf-8");
  const records = parse(raw, { columns: true, skip_empty_lines: true });

  for (const row of records) {
    const movieId = parseInt(row.movieId, 10);
    const imdbId = row.imdbId || null;
    const tmdbId = row.tmdbId ? parseInt(row.tmdbId, 10) : null;

    linkMap.set(movieId, { imdbId, tmdbId });

    // Attach to movieMap
    if (movieMap.has(movieId)) {
      movieMap.get(movieId).imdbId = imdbId;
      movieMap.get(movieId).tmdbId = tmdbId;
    }
  }
} catch {
  // links.csv not present
}

// ── Build title search index ────────────────────────────────────────────────
for (const [movieId, movie] of movieMap) {
  titleIndex.push({
    movieId,
    titleLower: movie.title.toLowerCase(),
    title: movie.title,
  });
}

// ── Exports ─────────────────────────────────────────────────────────────────
export { userMap, movieMap, tagMap, linkMap, titleIndex, GENRE_NAMES };

// ── Stats ───────────────────────────────────────────────────────────────────
export function getStats() {
  let totalRatings = 0;
  for (const ratings of userMap.values()) {
    totalRatings += ratings.length;
  }

  let totalTags = 0;
  for (const tags of tagMap.values()) {
    totalTags += tags.length;
  }

  return {
    totalUsers: userMap.size,
    totalMovies: movieMap.size,
    totalRatings,
    totalTags,
  };
}

// ── Title search (fuzzy) ────────────────────────────────────────────────────
export function searchByTitle(query, limit = 50) {
  const q = query.toLowerCase().trim();
  if (!q) return [];

  const terms = q.split(/\s+/);

  // Score-based ranking: exact substring > all terms present > partial matches
  const scored = [];
  for (const entry of titleIndex) {
    const t = entry.titleLower;
    let score = 0;

    // Exact substring match
    if (t.includes(q)) {
      score += 100;
      // Bonus for starts-with
      if (t.startsWith(q)) score += 50;
    }

    // Count how many query terms appear
    let termsMatched = 0;
    for (const term of terms) {
      if (t.includes(term)) {
        termsMatched++;
        score += 10;
      }
    }

    if (score > 0) {
      const movie = movieMap.get(entry.movieId);
      scored.push({
        movieId: entry.movieId,
        title: entry.title,
        genres: movie.genres,
        totalRatings: movie.ratings.length,
        averageRating: movie.ratings.length
          ? +(movie.ratings.reduce((s, r) => s + r.rating, 0) / movie.ratings.length).toFixed(2)
          : 0,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.totalRatings - a.totalRatings);
  return scored.slice(0, limit);
}

// ── Genre analytics ─────────────────────────────────────────────────────────
export function getGenreStats() {
  const genreData = GENRE_NAMES.map((name, i) => {
    let movieCount = 0;
    let totalRatings = 0;
    let ratingSum = 0;

    for (const [, movie] of movieMap) {
      if (movie.genreVector[i] === 1) {
        movieCount++;
        totalRatings += movie.ratings.length;
        ratingSum += movie.ratings.reduce((s, r) => s + r.rating, 0);
      }
    }

    return {
      genre: name,
      movieCount,
      totalRatings,
      averageRating: totalRatings > 0 ? +(ratingSum / totalRatings).toFixed(2) : 0,
    };
  });

  return genreData.sort((a, b) => b.totalRatings - a.totalRatings);
}

// ── Top movies ──────────────────────────────────────────────────────────────
export function getTopMovies(sortBy = "rating", limit = 25, minRatings = 10, genre = null) {
  const results = [];

  for (const [movieId, movie] of movieMap) {
    if (movie.ratings.length < minRatings) continue;

    // Genre filter
    if (genre) {
      const gi = GENRE_NAMES.indexOf(genre);
      if (gi === -1 || movie.genreVector[gi] !== 1) continue;
    }

    const avg = +(movie.ratings.reduce((s, r) => s + r.rating, 0) / movie.ratings.length).toFixed(2);

    // Compute standard deviation for "polarizing"
    const mean = avg;
    const variance = movie.ratings.reduce((s, r) => s + (r.rating - mean) ** 2, 0) / movie.ratings.length;
    const stdDev = +Math.sqrt(variance).toFixed(2);

    results.push({
      movieId,
      title: movie.title,
      genres: movie.genres,
      totalRatings: movie.ratings.length,
      averageRating: avg,
      stdDev,
    });
  }

  switch (sortBy) {
    case "rating":
      results.sort((a, b) => b.averageRating - a.averageRating);
      break;
    case "popular":
      results.sort((a, b) => b.totalRatings - a.totalRatings);
      break;
    case "polarizing":
      results.sort((a, b) => b.stdDev - a.stdDev);
      break;
    case "hidden_gem":
      // High rating, low ratings count
      results.sort((a, b) => {
        const scoreA = a.averageRating * (1 / Math.log2(a.totalRatings + 2));
        const scoreB = b.averageRating * (1 / Math.log2(b.totalRatings + 2));
        return scoreB - scoreA;
      });
      break;
    default:
      results.sort((a, b) => b.averageRating - a.averageRating);
  }

  return results.slice(0, limit);
}

// ── Rating distribution (global) ────────────────────────────────────────────
export function getRatingDistribution() {
  const buckets = {};
  for (let r = 0.5; r <= 5.0; r += 0.5) {
    buckets[r.toFixed(1)] = 0;
  }

  for (const [, movie] of movieMap) {
    for (const r of movie.ratings) {
      const key = r.rating.toFixed(1);
      if (buckets[key] !== undefined) buckets[key]++;
    }
  }

  return Object.entries(buckets).map(([rating, count]) => ({
    rating: parseFloat(rating),
    count,
  }));
}

// ── Ratings over time ───────────────────────────────────────────────────────
export function getRatingsOverTime() {
  const yearCounts = {};

  for (const [, movie] of movieMap) {
    for (const r of movie.ratings) {
      if (!r.timestamp) continue;
      const year = new Date(r.timestamp * 1000).getFullYear();
      if (!yearCounts[year]) yearCounts[year] = { count: 0, sum: 0 };
      yearCounts[year].count++;
      yearCounts[year].sum += r.rating;
    }
  }

  return Object.entries(yearCounts)
    .map(([year, data]) => ({
      year: parseInt(year),
      count: data.count,
      averageRating: +(data.sum / data.count).toFixed(2),
    }))
    .sort((a, b) => a.year - b.year);
}

// ── User genre profile ──────────────────────────────────────────────────────
export function getUserGenreProfile(userId) {
  const ratings = userMap.get(userId);
  if (!ratings) return null;

  const genreStats = GENRE_NAMES.map(() => ({ count: 0, sum: 0 }));

  for (const r of ratings) {
    const movie = movieMap.get(r.movieId);
    if (!movie) continue;
    for (let i = 0; i < GENRE_NAMES.length; i++) {
      if (movie.genreVector[i] === 1) {
        genreStats[i].count++;
        genreStats[i].sum += r.rating;
      }
    }
  }

  return GENRE_NAMES.map((name, i) => ({
    genre: name,
    count: genreStats[i].count,
    averageRating: genreStats[i].count > 0
      ? +(genreStats[i].sum / genreStats[i].count).toFixed(2)
      : 0,
  })).filter((g) => g.count > 0)
    .sort((a, b) => b.count - a.count);
}

// ── User rating distribution ────────────────────────────────────────────────
export function getUserRatingDistribution(userId) {
  const ratings = userMap.get(userId);
  if (!ratings) return null;

  const buckets = {};
  for (let r = 0.5; r <= 5.0; r += 0.5) {
    buckets[r.toFixed(1)] = 0;
  }

  for (const r of ratings) {
    const key = r.rating.toFixed(1);
    if (buckets[key] !== undefined) buckets[key]++;
  }

  return Object.entries(buckets).map(([rating, count]) => ({
    rating: parseFloat(rating),
    count,
  }));
}

// ── Movie rating distribution ───────────────────────────────────────────────
export function getMovieRatingDistribution(movieId) {
  const movie = movieMap.get(movieId);
  if (!movie) return null;

  const buckets = {};
  for (let r = 0.5; r <= 5.0; r += 0.5) {
    buckets[r.toFixed(1)] = 0;
  }

  for (const r of movie.ratings) {
    const key = r.rating.toFixed(1);
    if (buckets[key] !== undefined) buckets[key]++;
  }

  return Object.entries(buckets).map(([rating, count]) => ({
    rating: parseFloat(rating),
    count,
  }));
}

// ── Similar movies (cosine similarity on genre vectors) ─────────────────────
export function getSimilarMovies(movieId, limit = 10) {
  const target = movieMap.get(movieId);
  if (!target) return [];

  const targetVec = target.genreVector;
  const targetMag = Math.sqrt(targetVec.reduce((s, v) => s + v * v, 0));
  if (targetMag === 0) return [];

  const scored = [];

  for (const [id, movie] of movieMap) {
    if (id === movieId) continue;
    if (movie.ratings.length < 5) continue;

    const vec = movie.genreVector;
    const dot = targetVec.reduce((s, v, i) => s + v * vec[i], 0);
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (mag === 0) continue;

    const similarity = dot / (targetMag * mag);
    if (similarity > 0.5) {
      const avg = +(movie.ratings.reduce((s, r) => s + r.rating, 0) / movie.ratings.length).toFixed(2);
      scored.push({
        movieId: id,
        title: movie.title,
        genres: movie.genres,
        totalRatings: movie.ratings.length,
        averageRating: avg,
        similarity: +similarity.toFixed(3),
      });
    }
  }

  scored.sort((a, b) => b.similarity - a.similarity || b.averageRating - a.averageRating);
  return scored.slice(0, limit);
}

// ── Content-based recommendations for a user ────────────────────────────────
export function getRecommendations(userId, limit = 20) {
  const ratings = userMap.get(userId);
  if (!ratings) return [];

  // Build user preference vector: weighted average of genre vectors by rating
  const prefVector = new Array(GENRE_NAMES.length).fill(0);
  let totalWeight = 0;

  for (const r of ratings) {
    const movie = movieMap.get(r.movieId);
    if (!movie) continue;
    const weight = r.rating; // higher rated = more influence
    for (let i = 0; i < GENRE_NAMES.length; i++) {
      prefVector[i] += movie.genreVector[i] * weight;
    }
    totalWeight += weight;
  }

  if (totalWeight === 0) return [];
  for (let i = 0; i < prefVector.length; i++) {
    prefVector[i] /= totalWeight;
  }

  const prefMag = Math.sqrt(prefVector.reduce((s, v) => s + v * v, 0));
  if (prefMag === 0) return [];

  // Set of movies the user has already rated
  const ratedMovies = new Set(ratings.map((r) => r.movieId));

  // Score all unrated movies
  const scored = [];

  for (const [movieId, movie] of movieMap) {
    if (ratedMovies.has(movieId)) continue;
    if (movie.ratings.length < 5) continue;

    const vec = movie.genreVector;
    const dot = prefVector.reduce((s, v, i) => s + v * vec[i], 0);
    const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    if (mag === 0) continue;

    const similarity = dot / (prefMag * mag);
    const avg = +(movie.ratings.reduce((s, r) => s + r.rating, 0) / movie.ratings.length).toFixed(2);

    // Combined score: genre match * movie quality
    const score = similarity * avg;

    scored.push({
      movieId,
      title: movie.title,
      genres: movie.genres,
      totalRatings: movie.ratings.length,
      averageRating: avg,
      similarity: +similarity.toFixed(3),
      score: +score.toFixed(3),
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ── Movie rating trend over time ────────────────────────────────────────────
export function getMovieRatingTrend(movieId) {
  const movie = movieMap.get(movieId);
  if (!movie) return [];

  const yearData = {};
  for (const r of movie.ratings) {
    if (!r.timestamp) continue;
    const year = new Date(r.timestamp * 1000).getFullYear();
    if (!yearData[year]) yearData[year] = { count: 0, sum: 0 };
    yearData[year].count++;
    yearData[year].sum += r.rating;
  }

  return Object.entries(yearData)
    .map(([year, data]) => ({
      year: parseInt(year),
      count: data.count,
      averageRating: +(data.sum / data.count).toFixed(2),
    }))
    .sort((a, b) => a.year - b.year);
}
