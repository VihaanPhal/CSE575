"use client";

import { useMemo, useState } from "react";
import { PosterFrame } from "@/components/poster-frame";
import { RecommendationGrid } from "@/components/recommendation-grid";
import { useLocalStorageState, toggleIdInList } from "@/components/client-storage";

function RatingSelector({ value, onChange }) {
  return (
    <div className="flex flex-wrap gap-2">
      {[1, 2, 3, 4, 5].map((rating) => (
        <button
          key={rating}
          type="button"
          onClick={() => onChange(rating)}
          className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
            value === rating
              ? "bg-brand-700 text-white"
              : "border border-slate-200 text-slate-700 hover:border-brand-200 hover:text-brand-700"
          }`}
        >
          {rating}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(0)}
        className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
          value === 0
            ? "bg-slate-900 text-white"
            : "border border-slate-200 text-slate-700 hover:border-slate-300 hover:text-slate-950"
        }`}
      >
        Skip
      </button>
    </div>
  );
}

export function OnboardingClient({ interviewMovies }) {
  const [ratings, setRatings] = useLocalStorageState("coldStartRatings", {});
  const [savedMovieIds, setSavedMovieIds] = useLocalStorageState("savedMovies", []);
  const [dismissedMovieIds, setDismissedMovieIds] = useLocalStorageState("dismissedMovies", []);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeExplanation, setActiveExplanation] = useState(null);

  const ratedCount = useMemo(
    () => Object.values(ratings).filter((value) => Number(value) >= 4).length,
    [ratings]
  );

  async function generateRecommendations() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/recommendations/coldstart", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ratings,
          limit: 12,
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to generate recommendations.");
      }

      setResult(payload.recommendations);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[32px] border border-white/70 bg-white p-6 shadow-[0_25px_70px_rgba(29,78,216,0.12)]">
          <p className="font-mono text-xs uppercase tracking-[0.26em] text-brand-600">
            Cold-start interview
          </p>
          <h1 className="mt-3 text-4xl font-semibold text-slate-950">
            Teach the recommender your taste in a single pass.
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
            Rate a small, genre-diverse set of titles. The wiZAN cold-start path uses your
            positive ratings to infer a new-user factor and return a personalized shortlist.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-brand-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-brand-600">Rated positively</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-brand-900">{ratedCount}</p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Interview size</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-slate-900">
                {interviewMovies.length}
              </p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-amber-600">Recommendation mode</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">wiZAN Cold Start</p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_22px_65px_rgba(15,23,42,0.32)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-amber-300">
            Demo guidance
          </p>
          <ol className="mt-4 space-y-4 text-sm leading-6 text-slate-200">
            <li>1. Rate anything you like as 4 or 5 to seed positive feedback.</li>
            <li>2. Skip items you do not know.</li>
            <li>3. Generate the shortlist and inspect the “why” badges on each result.</li>
          </ol>

          <button
            type="button"
            onClick={generateRecommendations}
            disabled={loading}
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-2xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Generating…" : "Generate cold-start recommendations"}
          </button>

          {error ? (
            <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {interviewMovies.map((movie) => (
          <article
            key={movie.movieId}
            className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_14px_45px_rgba(148,163,184,0.14)]"
          >
            <div className="grid gap-4 sm:grid-cols-[112px_1fr]">
              <PosterFrame
                title={movie.title}
                posterUrl={movie.posterUrl}
                className="aspect-[2/3] min-h-[172px] w-full"
              />
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
                  Interview movie
                </p>
                <h2 className="mt-2 text-xl font-semibold text-slate-950">{movie.title}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">{movie.genres}</p>
                <p className="mt-4 text-xs font-medium uppercase tracking-[0.18em] text-slate-500">
                  {movie.nRatings.toLocaleString()} ratings in dataset
                </p>
                <div className="mt-5">
                  <RatingSelector
                    value={ratings[movie.movieId] ?? null}
                    onChange={(value) =>
                      setRatings((current) => ({
                        ...current,
                        [movie.movieId]: value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
              Personalized shortlist
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">
              Results appear here after the interview.
            </h2>
          </div>
        </div>

        <RecommendationGrid
          recommendations={result || []}
          savedMovieIds={savedMovieIds}
          dismissedMovieIds={dismissedMovieIds}
          onToggleSaved={(movieId) => setSavedMovieIds((current) => toggleIdInList(current, movieId))}
          onDismiss={(movieId) => setDismissedMovieIds((current) => toggleIdInList(current, movieId))}
          onExplain={(recommendation) => setActiveExplanation(recommendation)}
          emptyMessage="Rate a few titles and generate recommendations to populate this shortlist."
        />
      </section>

      {activeExplanation ? (
        <aside className="rounded-[32px] border border-brand-100 bg-brand-50 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
                Recommendation rationale
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-slate-950">
                {activeExplanation.title}
              </h3>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This cold-start result is based on the items you rated positively in the interview.
                Higher predicted scores indicate stronger alignment with the inferred user factor.
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
        </aside>
      ) : null}
    </div>
  );
}
