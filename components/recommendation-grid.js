"use client";

import Link from "next/link";
import { PosterFrame } from "@/components/poster-frame";

export function RecommendationGrid({
  recommendations,
  savedMovieIds = [],
  dismissedMovieIds = [],
  onToggleSaved,
  onDismiss,
  onExplain,
  emptyMessage = "No recommendations available.",
}) {
  const visibleRecommendations = recommendations.filter(
    (recommendation) => !dismissedMovieIds.includes(recommendation.movieId)
  );

  if (visibleRecommendations.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
      {visibleRecommendations.map((recommendation) => {
        const isSaved = savedMovieIds.includes(recommendation.movieId);

        return (
          <article
            key={`${recommendation.model}-${recommendation.movieId}`}
            className="group flex h-full flex-col rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_45px_rgba(148,163,184,0.14)] transition hover:-translate-y-1 hover:shadow-[0_24px_55px_rgba(29,78,216,0.14)]"
          >
            <div className="grid flex-1 gap-4 sm:grid-cols-[112px_1fr]">
              <Link href={`/movies/${recommendation.movieId}`} className="block">
                <PosterFrame
                  title={recommendation.title}
                  posterUrl={recommendation.posterUrl}
                  className="aspect-[2/3] min-h-[172px] w-full"
                />
              </Link>

              <div className="flex min-w-0 flex-col">
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.24em] text-brand-600">
                      {recommendation.model}
                    </p>
                    <Link
                      href={`/movies/${recommendation.movieId}`}
                      className="line-clamp-2 text-lg font-semibold text-slate-950 transition group-hover:text-brand-700"
                    >
                      {recommendation.title}
                    </Link>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {recommendation.genres || "Genre metadata unavailable"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-brand-50 px-3 py-2 text-right">
                    <p className="text-[11px] uppercase tracking-[0.2em] text-brand-600">Score</p>
                    <p className="font-mono text-lg font-semibold text-brand-900">
                      {recommendation.score}
                    </p>
                  </div>
                </div>

                {recommendation.reasonBadges.length ? (
                  <div className="mb-5 flex flex-wrap gap-2">
                    {recommendation.reasonBadges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                ) : null}

                <div className="mt-auto flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onToggleSaved(recommendation.movieId)}
                    className={`rounded-full px-3 py-2 text-xs font-semibold transition ${
                      isSaved
                        ? "bg-amber-400 text-slate-950"
                        : "border border-slate-200 text-slate-700 hover:border-amber-300 hover:text-slate-950"
                    }`}
                  >
                    {isSaved ? "Saved" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDismiss(recommendation.movieId)}
                    className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  >
                    Dismiss
                  </button>
                  <Link
                    href={`/discover?similarTo=${recommendation.movieId}`}
                    className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
                  >
                    More like this
                  </Link>
                  <button
                    type="button"
                    onClick={() => onExplain(recommendation)}
                    className="rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
                  >
                    Explain
                  </button>
                </div>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
