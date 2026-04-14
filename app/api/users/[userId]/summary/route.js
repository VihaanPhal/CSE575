import { NextResponse } from "next/server";
import { handleApiError, parseIntegerParam } from "@/lib/api";
import { getUserSummary } from "@/lib/recommendationService";

export async function GET(_request, context) {
  try {
    const params = await context.params;
    const userId = parseIntegerParam(params.userId, "userId", { min: 1 });
    return NextResponse.json(getUserSummary(userId));
  } catch (error) {
    return handleApiError(error);
  }
}
