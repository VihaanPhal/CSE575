"use client";

import { useState, useEffect } from "react";

// Star rating widget for interview movies
function StarRating({ movieId, value, onChange }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(movieId, star)}
          className={`text-lg transition-colors ${
            star <= (value ?? 0)
              ? "text-yellow-400"
              : "text-text-secondary/30 hover:text-yellow-400/60"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [searchType, setSearchType] = useState("user");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  // Cold-start state
  const [coldStartUserId, setColdStartUserId] = useState(null);
  const [interviewMovies, setInterviewMovies] = useState([]);
  const [interviewRatings, setInterviewRatings] = useState({});
  const [interviewLoading, setInterviewLoading] = useState(false);
  const [coldStartRecs, setColdStartRecs] = useState(null);
  const [coldStartSubmitting, setColdStartSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  function resetAll() {
    setResult(null);
    setError(null);
    setColdStartUserId(null);
    setInterviewMovies([]);
    setInterviewRatings({});
    setColdStartRecs(null);
  }

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    resetAll();

    try {
      const res = await fetch(
        `/api/search?type=${searchType}&q=${encodeURIComponent(query.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      // Unknown user — start cold-start flow
      if (data.newUser) {
        setColdStartUserId(data.userId);
        setInterviewLoading(true);
        try {
          const iRes = await fetch("/api/interview?count=10");
          const iData = await iRes.json();
          setInterviewMovies(iData.interviewMovies ?? []);
        } catch {
          setError("Could not load interview movies. Please try again.");
        } finally {
          setInterviewLoading(false);
        }
        return;
      }

      setResult(data);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleStarChange(movieId, star) {
    setInterviewRatings((prev) => ({ ...prev, [movieId]: star }));
  }

  async function handleSubmitRatings() {
    if (Object.keys(interviewRatings).length === 0) {
      setError("Please rate at least one movie before submitting.");
      return;
    }
    setColdStartSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/coldstart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ratings: interviewRatings, topN: 10 }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
      } else {
        setColdStartRecs(data.recommendations ?? []);
      }
    } catch {
      setError("Something went wrong submitting your ratings.");
    } finally {
      setColdStartSubmitting(false);
    }
  }

  const isNewUserFlow = coldStartUserId !== null;

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <main className="flex-1 flex flex-col items-center px-6 pt-24 pb-16">
        <div className="w-full max-w-3xl">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold tracking-tight text-accent">
                Recommendation System
              </h1>
              {stats && (
                <span className="text-xs font-mono px-2 py-1 rounded-full border border-border text-text-secondary">
                  {stats.totalUsers.toLocaleString()} users &middot;{" "}
                  {stats.totalMovies.toLocaleString()} movies &middot;{" "}
                  {stats.totalRatings.toLocaleString()} ratings
                </span>
              )}
            </div>
            <p className="text-text-secondary text-sm">
              Search by User ID or Movie ID. New users get personalised
              recommendations after rating a few movies.
            </p>
          </div>

          {/* Segmented Toggle */}
          <div className="flex gap-1 p-1 rounded-lg bg-surface border border-border mb-4">
            {["user", "movie"].map((t) => (
              <button
                key={t}
                onClick={() => { setSearchType(t); resetAll(); }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                  searchType === t
                    ? "bg-white text-black"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {t === "user" ? "Search by User ID" : "Search by Movie ID"}
              </button>
            ))}
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-8">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchType === "user"
                  ? "Enter user ID (e.g. 1)"
                  : "Enter movie ID (e.g. 1)"
              }
              className="flex-1 px-4 py-3 bg-surface border border-border rounded-lg text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:border-accent/30 transition-colors"
            />
            <button
              type="submit"
              disabled={loading || coldStartSubmitting}
              className="px-6 py-3 text-sm font-medium rounded-lg border border-border text-text-primary hover:bg-accent hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Search
            </button>
          </form>

          {/* Loading skeleton */}
          {(loading || interviewLoading) && (
            <div className="space-y-3">
              {[0, 0.15, 0.3].map((delay, i) => (
                <div
                  key={i}
                  className={`h-4 bg-surface rounded ${i === 0 ? "w-1/3" : i === 1 ? "w-2/3" : "w-1/2"}`}
                  style={{ animation: `pulse-subtle 1.5s ease-in-out ${delay}s infinite` }}
                />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div
              className="px-4 py-3 rounded-lg border border-error/30 bg-[#1a0000] text-error text-sm"
              style={{ animation: "fade-in 0.2s ease-out" }}
            >
              {error}
            </div>
          )}

          {/* ── COLD-START FLOW ──────────────────────────────── */}
          {isNewUserFlow && !interviewLoading && (
            <div style={{ animation: "fade-in 0.3s ease-out" }}>

              {/* Not-found banner */}
              {!coldStartRecs && (
                <>
                  <div className="bg-surface border border-border rounded-lg p-5 mb-6">
                    <p className="text-sm font-medium mb-1">
                      User&nbsp;
                      <span className="font-mono text-accent">{coldStartUserId}</span>
                      &nbsp;is not in the dataset yet.
                    </p>
                    <p className="text-xs text-text-secondary">
                      Rate the movies below so we can personalise your recommendations
                      using the wiZAN-Dual model (cold-start inference).
                    </p>
                  </div>

                  {/* Interview movies */}
                  <div className="bg-surface border border-border rounded-lg overflow-hidden mb-4">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <p className="text-xs text-text-secondary uppercase tracking-wider font-medium">
                        Rate these movies
                      </p>
                      <p className="text-xs font-mono text-text-secondary">
                        {Object.keys(interviewRatings).length} / {interviewMovies.length} rated
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">Title</th>
                          <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">Genres</th>
                          <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">Your Rating</th>
                        </tr>
                      </thead>
                      <tbody>
                        {interviewMovies.map((m) => (
                          <tr key={m.movieId} className="border-b border-border/50 hover:bg-white/[0.02]">
                            <td className="px-4 py-3">{m.title}</td>
                            <td className="px-4 py-3 text-text-secondary text-xs">{m.genres}</td>
                            <td className="px-4 py-3">
                              <StarRating
                                movieId={m.movieId}
                                value={interviewRatings[m.movieId]}
                                onChange={handleStarChange}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={handleSubmitRatings}
                    disabled={coldStartSubmitting || Object.keys(interviewRatings).length === 0}
                    className="w-full py-3 text-sm font-medium rounded-lg border border-border text-text-primary hover:bg-accent hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {coldStartSubmitting ? "Getting recommendations..." : "Get my recommendations"}
                  </button>
                </>
              )}

              {/* Cold-start recommendations */}
              {coldStartRecs && (
                <div style={{ animation: "fade-in 0.3s ease-out" }}>
                  <div className="bg-surface border border-border rounded-lg p-5 mb-4">
                    <p className="text-sm font-medium mb-1">
                      Recommendations for new user&nbsp;
                      <span className="font-mono text-accent">{coldStartUserId}</span>
                    </p>
                    <p className="text-xs text-text-secondary">
                      Generated via wiZAN-Dual cold-start inference from your ratings.
                    </p>
                  </div>

                  <div className="bg-surface border border-border rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                      <p className="text-xs text-text-secondary uppercase tracking-wider font-medium">
                        Top Recommendations (wiZAN-Dual)
                      </p>
                      <p className="text-xs font-mono text-text-secondary">
                        {coldStartRecs.length} items
                      </p>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">Rank</th>
                          <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">Title</th>
                          <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">Genres</th>
                          <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {coldStartRecs.map((rec, i) => (
                          <tr key={rec.item_id} className="border-b border-border/50 hover:bg-white/[0.02]">
                            <td className="px-4 py-3 font-mono text-text-secondary">{i + 1}</td>
                            <td className="px-4 py-3">{rec.title}</td>
                            <td className="px-4 py-3 text-text-secondary text-xs">{rec.genres}</td>
                            <td className="px-4 py-3 font-mono">{rec.predicted_rating.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={() => { setColdStartRecs(null); setInterviewRatings({}); }}
                    className="mt-4 w-full py-2 text-xs text-text-secondary border border-border rounded-lg hover:bg-surface transition-all"
                  >
                    Re-rate movies
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── EXISTING USER RESULT ─────────────────────────── */}
          {result && searchType === "user" && (
            <div style={{ animation: "fade-in 0.3s ease-out" }}>
              {/* Summary Card */}
              <div className="bg-surface border border-border rounded-lg p-6 mb-4">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">User ID</p>
                    <p className="text-lg font-mono font-medium">{result.userId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">Total Ratings</p>
                    <p className="text-lg font-mono font-medium">{result.totalRatings}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">Avg Rating</p>
                    <p className="text-lg font-mono font-medium">{result.averageRating} / 5</p>
                  </div>
                </div>
              </div>

              {/* wiZAN-Dual Recommendations */}
              {Array.isArray(result.recommendations) && result.recommendations.length > 0 && (
                <div className="bg-surface border border-border rounded-lg overflow-hidden mb-6">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <p className="text-xs text-text-secondary uppercase tracking-wider font-medium">
                      Top Recommendations (wiZAN-Dual)
                    </p>
                    <p className="text-xs font-mono text-text-secondary">
                      {result.recommendations.length} items
                    </p>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border">
                        {["Rank", "Movie ID", "Title", "Genres", "Score"].map((h) => (
                          <th key={h} className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.recommendations.map((rec, index) => (
                        <tr key={`${rec.item_id}-${index}`} className="border-b border-border/50 hover:bg-white/[0.02]">
                          <td className="px-4 py-3 font-mono text-text-secondary">{index + 1}</td>
                          <td className="px-4 py-3 font-mono text-text-secondary">{rec.item_id}</td>
                          <td className="px-4 py-3">{rec.title || "Unknown title"}</td>
                          <td className="px-4 py-3 text-text-secondary text-xs">{rec.genres || ""}</td>
                          <td className="px-4 py-3 font-mono">
                            {typeof rec.predicted_rating === "number"
                              ? rec.predicted_rating.toFixed(3)
                              : rec.predicted_rating}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {result.recommendationError && (
                <div className="mb-6 px-4 py-3 rounded-lg border border-border text-xs text-text-secondary">
                  Recommendation note: {result.recommendationError}
                </div>
              )}

              {/* Ratings Table */}
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Movie ID", "Title", "Rating", "Genres", "Date"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.ratings.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-mono text-text-secondary">{r.movieId}</td>
                        <td className="px-4 py-3">{r.title}</td>
                        <td className="px-4 py-3 font-mono">{r.rating}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs">{r.genres}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs font-mono">{r.datetime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── MOVIE SEARCH RESULT ──────────────────────────── */}
          {result && searchType === "movie" && (
            <div style={{ animation: "fade-in 0.3s ease-out" }}>
              <div className="bg-surface border border-border rounded-lg p-6 mb-4">
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">Movie ID</p>
                    <p className="text-lg font-mono font-medium">{result.movieId}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">Title</p>
                    <p className="text-lg font-medium">{result.title}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">Genres</p>
                    <p className="text-sm">{result.genres}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">Total Ratings</p>
                    <p className="text-lg font-mono font-medium">{result.totalRatings}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">Avg Rating</p>
                    <p className="text-lg font-mono font-medium">{result.averageRating} / 5</p>
                  </div>
                </div>
              </div>
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["User ID", "Rating", "Date"].map((h) => (
                        <th key={h} className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.ratings.map((r, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-white/[0.02]">
                        <td className="px-4 py-3 font-mono">{r.userId}</td>
                        <td className="px-4 py-3 font-mono">{r.rating}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs font-mono">{r.datetime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !interviewLoading && !error && !result && !isNewUserFlow && (
            <p className="text-center text-text-secondary/60 text-sm pt-8">
              Enter a query above to search the dataset.
            </p>
          )}
        </div>
      </main>

      <footer className="border-t border-border px-6 py-6">
        <p className="text-center text-xs text-text-secondary">
          MovieLens Search &middot; CSE575 Project
        </p>
      </footer>
    </div>
  );
}
