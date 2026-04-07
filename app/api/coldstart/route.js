import { getColdStartRecommendations } from "@/lib/loadWizanRecommendations";
import { NextResponse } from "next/server";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { ratings, topN = 10 } = body;

  if (!ratings || typeof ratings !== "object" || Array.isArray(ratings)) {
    return NextResponse.json(
      { error: "Body must include 'ratings': { movieId: starRating, ... }" },
      { status: 400 }
    );
  }

  if (Object.keys(ratings).length === 0) {
    return NextResponse.json(
      { error: "Please provide at least one rating." },
      { status: 400 }
    );
  }

  try {
    const result = await getColdStartRecommendations({ ratings, topN });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cold-start recommendation failed." },
      { status: 500 }
    );
  }
}
