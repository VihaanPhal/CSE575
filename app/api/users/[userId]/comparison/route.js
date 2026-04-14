import { NextResponse } from "next/server";
import { handleApiError, parseIntegerParam } from "@/lib/api";
import { getUserComparison } from "@/lib/recommendationService";

export const runtime = "nodejs";

export async function GET(request, context) {
  try {
    const params = await context.params;
    const userId = parseIntegerParam(params.userId, "userId", { min: 1 });
    const { searchParams } = new URL(request.url);
    const limit = parseIntegerParam(searchParams.get("limit"), "limit", {
      min: 1,
      max: 20,
      required: false,
    });

    const payload = await getUserComparison(userId, limit ?? 6);
    return NextResponse.json(payload);
  } catch (error) {
    return handleApiError(error);
  }
}
