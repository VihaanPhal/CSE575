import { userMap, movieMap } from "@/lib/loadMovies";
import { getMatrixRecommendations } from "@/lib/loadRecommendations";
import { getWizanRecommendations } from "@/lib/loadWizanRecommendations";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  if (type !== "user" && type !== "movie") {
    return NextResponse.json(
      { error: "Parameter 'type' must be 'user' or 'movie'" },
      { status: 400 }
    );
  }

  const id = parseInt(q, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Query must be a valid number" }, { status: 400 });
  }

  if (type === "user") {
    const ratings = userMap.get(id);
    if (!ratings) {
      // Unknown user — trigger cold-start flow on the frontend
      return NextResponse.json({ newUser: true, userId: id });
    }

    let recommendations = [];
    let recommendationError = null;

    try {
      const recResult = await getWizanRecommendations({ userId: id, topN: 10 });
      recommendations = recResult.recommendations;
    } catch (wizanErr) {
      // Fall back to SVD if wiZAN fails
      try {
        const recResult = await getMatrixRecommendations({ userId: id, topN: 10, method: "svd" });
        recommendations = recResult.recommendations;
      } catch (err) {
        recommendationError =
          err instanceof Error ? err.message : "Recommendation engine is currently unavailable.";
      }
    }

    return NextResponse.json({
      userId: id,
      totalRatings: ratings.length,
      averageRating: +(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(2),
      ratings,
      recommendations,
      recommendationError,
    });
  }

  // type === "movie"
  const movie = movieMap.get(id);
  if (!movie) {
    return NextResponse.json(
      { error: `No movie found with ID '${q}'` },
      { status: 404 }
    );
  }
  return NextResponse.json({
    movieId: id,
    title: movie.title,
    genres: movie.genres,
    totalRatings: movie.ratings.length,
    averageRating: +(movie.ratings.reduce((sum, r) => sum + r.rating, 0) / movie.ratings.length).toFixed(2),
    ratings: movie.ratings,
  });
}
