import { NextResponse } from "next/server";
import { handleApiError, parseIntegerParam, parseModelParam } from "@/lib/api";
import {
  getModelRecommendations,
  SUPPORTED_MODELS,
} from "@/lib/recommendationService";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = parseIntegerParam(searchParams.get("userId"), "userId", { min: 1 });
    const limit = parseIntegerParam(searchParams.get("limit"), "limit", {
      min: 1,
      max: 50,
      required: false,
    });
    const model = parseModelParam(searchParams.get("model"), SUPPORTED_MODELS);

    const recommendations = await getModelRecommendations(userId, {
      model,
      limit: limit ?? 20,
    });

    return NextResponse.json({
      userId,
      model,
      totalRecommendations: recommendations.length,
      recommendations,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
