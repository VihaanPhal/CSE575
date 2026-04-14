"use client";

import { startTransition, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { RecommendationGrid } from "@/components/recommendation-grid";
import { useLocalStorageState, toggleIdInList } from "@/components/client-storage";

export function DiscoverClient({ payload }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [savedMovieIds, setSavedMovieIds] = useLocalStorageState("savedMovies", []);
  const [dismissedMovieIds, setDismissedMovieIds] = useLocalStorageState("dismissedMovies", []);
  const [activeExplanation, setActiveExplanation] = useState(null);

  function updateParam(key, value) {
    const next = new URLSearchParams(searchParams.toString());
    if (!value) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    startTransition(() => router.replace(`${pathname}?${next.toString()}`));
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_28px_85px_rgba(29,78,216,0.1)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
              Discovery hub
            </p>
            <h1 className="mt-2 text-4xl font-semibold text-slate-950">
              {payload.mode === "similar"
                ? `More like ${payload.baseMovie.title}`
                : "Browse the catalog by recommendation intent"}
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
              Switch between crowd favorites, hidden gems, high-variance picks, and genre slices.
              This screen is designed for exploration rather than a single-model feed.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm font-medium text-slate-700">
              Sort
              <select
                value={payload.sortBy}
                onChange={(event) => updateParam("sort", event.target.value)}
                className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-950"
              >
                <option value="rating">Highest rated</option>
                <option value="popular">Most popular</option>
                <option value="hidden_gem">Hidden gems</option>
                <option value="polarizing">Polarizing</option>
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Genre
              <select
                value={payload.genre || ""}
                onChange={(event) => updateParam("genre", event.target.value)}
                className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-950"
              >
                <option value="">All genres</option>
                {payload.genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm font-medium text-slate-700">
              Min ratings
              <input
                type="number"
                min={1}
                value={payload.minRatings}
                onChange={(event) => updateParam("min", event.target.value)}
                className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-950"
              />
            </label>
          </div>
        </div>
      </section>

      <RecommendationGrid
        recommendations={payload.movies}
        savedMovieIds={savedMovieIds}
        dismissedMovieIds={dismissedMovieIds}
        onToggleSaved={(movieId) => setSavedMovieIds((current) => toggleIdInList(current, movieId))}
        onDismiss={(movieId) => setDismissedMovieIds((current) => toggleIdInList(current, movieId))}
        onExplain={(recommendation) => setActiveExplanation(recommendation)}
        emptyMessage="No movies matched the active filters."
      />

      {activeExplanation ? (
        <section className="rounded-[32px] border border-brand-100 bg-brand-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
                Browse rationale
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-slate-950">
                {activeExplanation.title}
              </h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">
                Discover results are ranked from dataset statistics. Use the score, average rating,
                and support badges to compare mainstream hits against niche picks.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveExplanation(null)}
              className="rounded-full border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700"
            >
              Close
            </button>
          </div>
        </section>
      ) : null}
    </div>
  );
}
