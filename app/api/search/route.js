import { userMap, movieMap } from "@/lib/loadMovies";
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
      return NextResponse.json(
        { error: `No user found with ID '${q}'` },
        { status: 404 }
      );
    }
    return NextResponse.json({
      userId: id,
      totalRatings: ratings.length,
      averageRating: +(ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length).toFixed(2),
      ratings,
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
