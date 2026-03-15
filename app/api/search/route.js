import { indexMap, nameMap } from "@/lib/loadMovies";
import { NextResponse } from "next/server";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const q = searchParams.get("q");

  if (!q) {
    return NextResponse.json({ error: "Missing query parameter 'q'" }, { status: 400 });
  }

  if (type !== "index" && type !== "name") {
    return NextResponse.json(
      { error: "Parameter 'type' must be 'index' or 'name'" },
      { status: 400 }
    );
  }

  let result;

  if (type === "index") {
    result = indexMap.get(parseInt(q, 10));
  } else {
    result = nameMap.get(q.toLowerCase());
  }

  if (!result) {
    return NextResponse.json(
      { error: `No match found for '${q}'` },
      { status: 404 }
    );
  }

  return NextResponse.json(result);
}
