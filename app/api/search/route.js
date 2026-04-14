import { NextResponse } from "next/server";
import {
  ApiError,
  handleApiError,
  parseIntegerParam,
  parseModelParam,
} from "@/lib/api";
import {
  getMovieDetail,
  getUserSummary,
  getModelRecommendations,
  searchTitles,
  SUPPORTED_MODELS,
} from "@/lib/recommendationService";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const query = searchParams.get("q")?.trim();
    const model = parseModelParam(searchParams.get("model"), SUPPORTED_MODELS);
    const limit = parseIntegerParam(searchParams.get("limit"), "limit", {
      min: 1,
      max: 50,
      required: false,
    });

    if (!query) {
      throw new ApiError(400, "MISSING_QUERY", "Missing query parameter 'q'.");
    }

    if (!["title", "user", "movie"].includes(type)) {
      return NextResponse.json(
        {
          code: "INVALID_TYPE",
          message: "Parameter 'type' must be 'title', 'user', or 'movie'.",
        },
        { status: 400 }
      );
    }

    if (type === "title") {
      const results = await searchTitles(query, limit ?? 20);
      return NextResponse.json({
        query,
        totalResults: results.length,
        results,
      });
    }

    const id = parseIntegerParam(query, "q", { min: 1 });

    if (type === "user") {
      const summary = getUserSummary(id);
      const recommendations = await getModelRecommendations(id, {
        model,
        limit: limit ?? 15,
      });

      return NextResponse.json({
        userId: summary.user.userId,
        totalRatings: summary.user.totalRatings,
        averageRating: summary.user.averageRating,
        ratings: summary.history,
        genreProfile: summary.profile.genreProfile,
        ratingDistribution: summary.profile.ratingDistribution,
        recommendations,
      });
    }

    const movie = await getMovieDetail(id);
    return NextResponse.json(movie);
  } catch (error) {
    return handleApiError(error);
  }
}
