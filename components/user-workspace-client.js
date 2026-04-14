"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { DistributionChart, GenreRadarChart } from "@/components/chart-panels";
import { PosterFrame } from "@/components/poster-frame";
import { RecommendationGrid } from "@/components/recommendation-grid";
import { useLocalStorageState, toggleIdInList } from "@/components/client-storage";

function ExplanationPanel({ recommendation, onClose }) {
  if (!recommendation) return null;

  return (
    <aside className="rounded-[32px] border border-brand-100 bg-brand-50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
            Why this recommendation
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">
            {recommendation.title}
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            {recommendation.explanation
              ? "This card includes explicit contribution data from the backend."
              : "This recommendation is derived from the selected model’s ranking score and its overlap with the user profile."}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full border border-brand-200 px-3 py-2 text-xs font-semibold text-brand-700"
        >
          Close
        </button>
      </div>

      {recommendation.explanation ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Rating contribution</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">
              {recommendation.explanation.rating_contribution ?? "—"}
            </p>
          </div>
          <div className="rounded-3xl bg-white p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Genre contribution</p>
            <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">
              {recommendation.explanation.genre_contribution ?? "—"}
            </p>
          </div>
        </div>
      ) : null}

      {recommendation.explanation?.top_genre_matches?.length ? (
        <div className="mt-6 rounded-3xl bg-white p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Top genre matches</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {recommendation.explanation.top_genre_matches.map((match) => (
              <span
                key={match.genre}
                className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700"
              >
                {match.genre}: {match.value}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </aside>
  );
}

export function UserWorkspaceClient({ workspace }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [savedMovieIds, setSavedMovieIds] = useLocalStorageState("savedMovies", []);
  const [dismissedMovieIds, setDismissedMovieIds] = useLocalStorageState("dismissedMovies", []);
  const [recentQueries, setRecentQueries] = useLocalStorageState("recentQueries", []);
  const [, setCurrentUser] = useLocalStorageState("currentUser", null);
  const [selectedModel, setSelectedModel] = useLocalStorageState("selectedModel", workspace.activeModel);
  const [activeExplanation, setActiveExplanation] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [comparisonLoading, setComparisonLoading] = useState(false);
  const [comparisonError, setComparisonError] = useState(null);

  useEffect(() => {
    setCurrentUser(workspace.user.userId);
    setSelectedModel(workspace.activeModel);
    setRecentQueries((current) => {
      const next = [`user:${workspace.user.userId}`, ...current.filter((entry) => entry !== `user:${workspace.user.userId}`)];
      return next.slice(0, 10);
    });
  }, [setCurrentUser, setRecentQueries, setSelectedModel, workspace.activeModel, workspace.user.userId]);

  const visibleHistory = useMemo(() => workspace.history.slice(0, 12), [workspace.history]);

  function switchModel(modelKey) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("model", modelKey);
    startTransition(() => router.replace(`/users/${workspace.user.userId}?${next.toString()}`));
  }

  async function loadComparison() {
    setComparisonLoading(true);
    setComparisonError(null);
    try {
      const response = await fetch(`/api/users/${workspace.user.userId}/comparison?limit=5`);
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.message || "Failed to load model comparison.");
      }
      setComparison(payload);
    } catch (error) {
      setComparisonError(error.message);
    } finally {
      setComparisonLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[32px] border border-white/70 bg-white p-6 shadow-[0_28px_85px_rgba(29,78,216,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
                Existing user workspace
              </p>
              <h1 className="mt-2 text-4xl font-semibold text-slate-950">
                User {workspace.user.userId}
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
                Switch between recommendation models, inspect explanations, save shortlist items,
                and compare how each backend path ranks the same user.
              </p>
            </div>
            <Link
              href="/onboarding"
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
            >
              Try new-user flow
            </Link>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-4">
            <div className="rounded-3xl bg-brand-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-brand-600">Total ratings</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-brand-900">
                {workspace.user.totalRatings}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Average rating</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">
                {workspace.user.averageRating}
              </p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-600">Dominant genres</p>
              <p className="mt-2 text-base font-semibold text-slate-950">
                {workspace.user.dominantGenres.join(" · ")}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-950 p-4 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-300">Active model</p>
              <p className="mt-2 text-base font-semibold">{workspace.activeModel}</p>
            </div>
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_22px_65px_rgba(15,23,42,0.28)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-amber-300">
            Session memory
          </p>
          <div className="mt-5 space-y-5">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Saved shortlist</p>
              <p className="mt-2 text-2xl font-semibold">{savedMovieIds.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Dismissed items</p>
              <p className="mt-2 text-2xl font-semibold">{dismissedMovieIds.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recent activity</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {recentQueries.slice(0, 4).map((entry) => (
                  <span
                    key={entry}
                    className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
                  >
                    {entry}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_20px_65px_rgba(148,163,184,0.12)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
              Model switcher
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Explore the backend from the frontend
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {workspace.modelCatalog.map((model) => (
              <button
                key={model.key}
                type="button"
                onClick={() => switchModel(model.key)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  workspace.activeModel === model.key
                    ? "bg-brand-700 text-white"
                    : "border border-slate-200 text-slate-700 hover:border-brand-200 hover:text-brand-700"
                }`}
              >
                {model.label}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
          {workspace.modelCatalog.find((model) => model.key === workspace.activeModel)?.description}
        </p>
        {workspace.bridgeWarning ? (
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {workspace.requestedModel} could not be loaded through the Python bridge, so the UI
            fell back to the content model for this request. {workspace.bridgeWarning}
          </p>
        ) : null}
      </section>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
              Active recommendations
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">
              {workspace.modelCatalog.find((model) => model.key === workspace.activeModel)?.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={loadComparison}
            disabled={comparisonLoading}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {comparisonLoading ? "Loading comparison…" : "Load model comparison"}
          </button>
        </div>

        <RecommendationGrid
          recommendations={workspace.recommendations}
          savedMovieIds={savedMovieIds}
          dismissedMovieIds={dismissedMovieIds}
          onToggleSaved={(movieId) => setSavedMovieIds((current) => toggleIdInList(current, movieId))}
          onDismiss={(movieId) => setDismissedMovieIds((current) => toggleIdInList(current, movieId))}
          onExplain={(recommendation) => setActiveExplanation(recommendation)}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
            Taste profile
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Genre preferences</h2>
          <div className="mt-5">
            <GenreRadarChart data={workspace.profile.genreProfile.slice(0, 8)} />
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
            Rating behavior
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Distribution</h2>
          <div className="mt-5">
            <DistributionChart data={workspace.profile.ratingDistribution} />
          </div>
        </div>
      </section>

      <ExplanationPanel
        recommendation={activeExplanation}
        onClose={() => setActiveExplanation(null)}
      />

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
              Recently rated
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Latest ratings from the profile
            </h2>
          </div>
          <p className="text-sm text-slate-500">{workspace.history.length} total rows</p>
        </div>

        <div className="mt-5 overflow-hidden rounded-[28px] border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Movie</th>
                <th className="px-4 py-3">Rating</th>
                <th className="px-4 py-3">Genres</th>
                <th className="px-4 py-3">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {visibleHistory.map((row) => (
                <tr key={`${row.movieId}-${row.timestamp}`} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link href={`/movies/${row.movieId}`} className="font-medium text-slate-950">
                      {row.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700">{row.rating}</td>
                  <td className="px-4 py-3 text-slate-600">{row.genres}</td>
                  <td className="px-4 py-3 text-slate-500">{row.datetime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
              Cross-model view
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">
              Comparison across the backend surface
            </h2>
          </div>
        </div>

        {comparisonError ? (
          <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {comparisonError}
          </p>
        ) : null}

        {comparison ? (
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {Object.entries(comparison.models).map(([model, rows]) => (
              <div key={model} className="rounded-[28px] border border-slate-200 bg-slate-50 p-5">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-brand-600">
                  {model}
                </p>
                <div className="mt-4 space-y-3">
                  {rows.slice(0, 4).map((row) => (
                    <Link
                      key={`${model}-${row.movieId}`}
                      href={`/movies/${row.movieId}`}
                      className="grid gap-3 rounded-2xl bg-white p-3 transition hover:bg-slate-100 sm:grid-cols-[62px_1fr]"
                    >
                      <PosterFrame
                        title={row.title}
                        posterUrl={row.posterUrl}
                        className="aspect-[2/3] min-h-[92px] w-full rounded-[18px]"
                        sizes="62px"
                      />
                      <div className="min-w-0">
                        <p className="line-clamp-2 font-semibold text-slate-950">{row.title}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Score {row.score} · {row.genres}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Load the comparison to view how content, simple, matrix factorization, wiZAN,
            and ensemble paths rank this user differently.
          </p>
        )}
      </section>
    </div>
  );
}
