import { NextResponse } from "next/server";
import { handleApiError, parseIntegerParam } from "@/lib/api";
import { getMovieDetail } from "@/lib/recommendationService";

export async function GET(_request, context) {
  try {
    const params = await context.params;
    const movieId = parseIntegerParam(params.movieId, "movieId", { min: 1 });
    const payload = await getMovieDetail(movieId);
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
