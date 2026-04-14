import { NextResponse } from "next/server";
import {
  handleApiError,
  parseIntegerParam,
  parseJsonBody,
  ApiError,
} from "@/lib/api";
import { getColdStartRecommendations } from "@/lib/recommendationService";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json();
    const ratings = parseJsonBody(body, "ratings");
    const limit = parseIntegerParam(String(body.limit ?? ""), "limit", {
      min: 1,
      max: 30,
      required: false,
    });

    if (typeof ratings !== "object" || Array.isArray(ratings)) {
      throw new ApiError(400, "INVALID_RATINGS", "'ratings' must be an object keyed by movieId.");
    }

    const recommendations = await getColdStartRecommendations(ratings, limit ?? 12);
    return NextResponse.json({
      method: "wizan-coldstart",
      recommendations,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
