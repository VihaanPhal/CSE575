import { DiscoverClient } from "@/components/discover-client";
import { getDiscoverPayload, searchTitles } from "@/lib/recommendationService";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({ searchParams }) {
  const params = await searchParams;
  const similarTo = params.similarTo ? Number(params.similarTo) : null;

  const payload = await getDiscoverPayload({
    sortBy: params.sort || "rating",
    limit: params.limit ? Number(params.limit) : 24,
    minRatings: params.min ? Number(params.min) : 20,
    genre: params.genre || null,
    similarTo: Number.isFinite(similarTo) ? similarTo : null,
  });

  if (params.query) {
    const titleMatches = await searchTitles(params.query, 9);
    payload.movies = titleMatches;
    payload.totalResults = titleMatches.length;
    payload.mode = "search";
  }

  return <DiscoverClient payload={payload} />;
}
