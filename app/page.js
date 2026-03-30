"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [searchType, setSearchType] = useState("user");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setStats(data))
      .catch(() => setStats(null));
  }, []);

  async function handleSearch(e) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch(
        `/api/search?type=${searchType}&q=${encodeURIComponent(query.trim())}`
      );
      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
      } else {
        setResult(data);
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

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
              Search the MovieLens dataset by User ID or Movie ID.
            </p>
          </div>

          {/* Segmented Toggle */}
          <div className="flex gap-1 p-1 rounded-lg bg-surface border border-border mb-4">
            <button
              onClick={() => {
                setSearchType("user");
                setResult(null);
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                searchType === "user"
                  ? "bg-white text-black"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Search by User ID
            </button>
            <button
              onClick={() => {
                setSearchType("movie");
                setResult(null);
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                searchType === "movie"
                  ? "bg-white text-black"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Search by Movie ID
            </button>
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
              disabled={loading}
              className="px-6 py-3 text-sm font-medium rounded-lg border border-border text-text-primary hover:bg-accent hover:text-black transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Search
            </button>
          </form>

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              <div
                className="h-4 bg-surface rounded w-1/3"
                style={{ animation: "pulse-subtle 1.5s ease-in-out infinite" }}
              />
              <div
                className="h-4 bg-surface rounded w-2/3"
                style={{
                  animation: "pulse-subtle 1.5s ease-in-out infinite 0.15s",
                }}
              />
              <div
                className="h-4 bg-surface rounded w-1/2"
                style={{
                  animation: "pulse-subtle 1.5s ease-in-out infinite 0.3s",
                }}
              />
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

          {/* User Search Result */}
          {result && searchType === "user" && (
            <div style={{ animation: "fade-in 0.3s ease-out" }}>
              {/* Summary Card */}
              <div className="bg-surface border border-border rounded-lg p-6 mb-4">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                      User ID
                    </p>
                    <p className="text-lg font-mono font-medium">
                      {result.userId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                      Total Ratings
                    </p>
                    <p className="text-lg font-mono font-medium">
                      {result.totalRatings}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                      Avg Rating
                    </p>
                    <p className="text-lg font-mono font-medium">
                      {result.averageRating} / 5
                    </p>
                  </div>
                </div>
              </div>

              {/* Ratings Table */}
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">
                        Movie ID
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">
                        Title
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">
                        Rating
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">
                        Genres
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.ratings.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-mono text-text-secondary">
                          {r.movieId}
                        </td>
                        <td className="px-4 py-3">{r.title}</td>
                        <td className="px-4 py-3 font-mono">{r.rating}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs">
                          {r.genres}
                        </td>
                        <td className="px-4 py-3 text-text-secondary text-xs font-mono">
                          {r.datetime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Movie Search Result */}
          {result && searchType === "movie" && (
            <div style={{ animation: "fade-in 0.3s ease-out" }}>
              {/* Summary Card */}
              <div className="bg-surface border border-border rounded-lg p-6 mb-4">
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                      Movie ID
                    </p>
                    <p className="text-lg font-mono font-medium">
                      {result.movieId}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                      Title
                    </p>
                    <p className="text-lg font-medium">{result.title}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                      Genres
                    </p>
                    <p className="text-sm">{result.genres}</p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                      Total Ratings
                    </p>
                    <p className="text-lg font-mono font-medium">
                      {result.totalRatings}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                      Avg Rating
                    </p>
                    <p className="text-lg font-mono font-medium">
                      {result.averageRating} / 5
                    </p>
                  </div>
                </div>
              </div>

              {/* Ratings Table */}
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">
                        User ID
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">
                        Rating
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-text-secondary uppercase tracking-wider font-medium">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.ratings.map((r, i) => (
                      <tr
                        key={i}
                        className="border-b border-border/50 hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-3 font-mono">{r.userId}</td>
                        <td className="px-4 py-3 font-mono">{r.rating}</td>
                        <td className="px-4 py-3 text-text-secondary text-xs font-mono">
                          {r.datetime}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && !result && (
            <p className="text-center text-text-secondary/60 text-sm pt-8">
              Enter a query above to search the dataset.
            </p>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-6 py-6">
        <p className="text-center text-xs text-text-secondary">
          MovieLens Search &middot; CSE575 Project
        </p>
      </footer>
    </div>
  );
}
