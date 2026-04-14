import "dotenv/config";

const TMDB_API_KEY = process.env.TMDB_API_KEY?.trim() || "";
const TMDB_BASE_URL = "https://api.themoviedb.org/3/movie";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p/w500";
const HAS_TMDB_KEY =
  TMDB_API_KEY &&
  TMDB_API_KEY !== "your_tmdb_api_key_here" &&
  TMDB_API_KEY !== "replace_with_real_tmdb_api_key";

const posterCache = new Map();

export async function getPosterUrl(tmdbId) {
  if (!HAS_TMDB_KEY || !tmdbId) {
    return null;
  }

  if (posterCache.has(tmdbId)) {
    return posterCache.get(tmdbId);
  }

  try {
    const response = await fetch(`${TMDB_BASE_URL}/${tmdbId}?api_key=${TMDB_API_KEY}`, {
      next: { revalidate: 60 * 60 * 24 },
    });

    if (!response.ok) {
      posterCache.set(tmdbId, null);
      return null;
    }

    const payload = await response.json();
    const posterUrl = payload.poster_path ? `${TMDB_IMAGE_BASE}${payload.poster_path}` : null;
    posterCache.set(tmdbId, posterUrl);
    return posterUrl;
  } catch {
    posterCache.set(tmdbId, null);
    return null;
  }
}
