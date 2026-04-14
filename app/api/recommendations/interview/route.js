import { NextResponse } from "next/server";
import { handleApiError, parseIntegerParam } from "@/lib/api";
import { getInterviewMovies } from "@/lib/recommendationService";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const count = parseIntegerParam(searchParams.get("count"), "count", {
      min: 5,
      max: 20,
      required: false,
    });
    const interviewMovies = await getInterviewMovies(count ?? 12);
    return NextResponse.json({ interviewMovies });
  } catch (error) {
    return handleApiError(error);
  }
}
