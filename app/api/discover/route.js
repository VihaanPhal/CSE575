import { NextResponse } from "next/server";
import { ApiError, handleApiError, parseIntegerParam } from "@/lib/api";
import { getDiscoverPayload } from "@/lib/recommendationService";

const SORT_OPTIONS = new Set(["rating", "popular", "hidden_gem", "polarizing"]);

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sortBy = searchParams.get("sort") || "rating";
    const limit = parseIntegerParam(searchParams.get("limit"), "limit", {
      min: 1,
      max: 100,
      required: false,
    });
    const minRatings = parseIntegerParam(searchParams.get("min"), "min", {
      min: 1,
      max: 5000,
      required: false,
    });
    const similarTo = parseIntegerParam(searchParams.get("similarTo"), "similarTo", {
      min: 1,
      required: false,
    });
    const genre = searchParams.get("genre") || null;

    if (!SORT_OPTIONS.has(sortBy)) {
      throw new ApiError(
        400,
        "INVALID_SORT",
        "Sort must be 'rating', 'popular', 'hidden_gem', or 'polarizing'."
      );
    }

    const payload = await getDiscoverPayload({
      sortBy,
      limit: limit ?? 24,
      minRatings: minRatings ?? 20,
      genre,
      similarTo,
    });

    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
