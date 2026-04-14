import { NextResponse } from "next/server";
import { handleApiError } from "@/lib/api";
import { getAnalyticsPayload } from "@/lib/recommendationService";

export const runtime = "nodejs";

export async function GET() {
  try {
    const payload = await getAnalyticsPayload();
    return NextResponse.json(payload.benchmarks);
  } catch (error) {
    return handleApiError(error);
  }
}
