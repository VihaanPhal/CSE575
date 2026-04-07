import { getInterviewMovies } from "@/lib/loadWizanRecommendations";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const count = Math.min(20, Math.max(5, parseInt(searchParams.get("count") ?? "10", 10)));

  try {
    const result = await getInterviewMovies({ count });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load interview movies." },
      { status: 500 }
    );
  }
}
