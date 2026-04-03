import { getMatrixRecommendations } from "@/lib/loadRecommendations";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const userIdParam = searchParams.get("userId");
  const topNParam = searchParams.get("topN") ?? "5";
  const method = searchParams.get("method") ?? "svd";

  if (!userIdParam) {
    return NextResponse.json(
      { error: "Missing query parameter 'userId'" },
      { status: 400 }
    );
  }

  const userId = Number.parseInt(userIdParam, 10);
  const topN = Number.parseInt(topNParam, 10);

  if (!Number.isFinite(userId) || Number.isNaN(userId)) {
    return NextResponse.json(
      { error: "Parameter 'userId' must be a valid integer" },
      { status: 400 }
    );
  }

  if (!Number.isFinite(topN) || Number.isNaN(topN) || topN < 1) {
    return NextResponse.json(
      { error: "Parameter 'topN' must be a positive integer" },
      { status: 400 }
    );
  }

  if (method !== "svd" && method !== "gd") {
    return NextResponse.json(
      { error: "Parameter 'method' must be 'svd' or 'gd'" },
      { status: 400 }
    );
  }

  try {
    const result = await getMatrixRecommendations({ userId, topN, method });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Recommendation engine failed to run";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
