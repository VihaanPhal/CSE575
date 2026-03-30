import { readFileSync } from "fs";
import { join } from "path";
import { parse } from "csv-parse/sync";

const csvPath = join(process.cwd(), "cse575_sorting", "movielens_combined.csv");

let userMap = new Map(); // Map<userId, Array<{movieId, title, rating, genres, datetime}>>
let movieMap = new Map(); // Map<movieId, {title, genres, ratings: Array<{userId, rating, datetime}>}>

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

    // Build userMap
    if (!userMap.has(userId)) {
      userMap.set(userId, []);
    }
    userMap.get(userId).push({ movieId, title, rating, genres, datetime });

    // Build movieMap
    if (!movieMap.has(movieId)) {
      movieMap.set(movieId, { title, genres, ratings: [] });
    }
    movieMap.get(movieId).ratings.push({ userId, rating, datetime });
  }
} catch {
  // CSV not present — maps stay empty
}

export { userMap, movieMap };

export function getStats() {
  let totalRatings = 0;
  for (const ratings of userMap.values()) {
    totalRatings += ratings.length;
  }
  return {
    totalUsers: userMap.size,
    totalMovies: movieMap.size,
    totalRatings,
  };
}
