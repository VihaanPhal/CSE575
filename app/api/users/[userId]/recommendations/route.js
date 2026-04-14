import { NextResponse } from "next/server";
import {
  handleApiError,
  parseIntegerParam,
  parseModelParam,
} from "@/lib/api";
import {
  getModelRecommendations,
  SUPPORTED_MODELS,
} from "@/lib/recommendationService";

export const runtime = "nodejs";

export async function GET(request, context) {
  try {
    const params = await context.params;
    const userId = parseIntegerParam(params.userId, "userId", { min: 1 });
    const { searchParams } = new URL(request.url);
    const model = parseModelParam(searchParams.get("model"), SUPPORTED_MODELS);
    const limit = parseIntegerParam(searchParams.get("limit"), "limit", {
      min: 1,
      max: 50,
      required: false,
    });

    const recommendations = await getModelRecommendations(userId, {
      model,
      limit: limit ?? 12,
    });

    return NextResponse.json({
      userId,
      model,
      recommendations,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
