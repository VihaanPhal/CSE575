"use client";

import { useState, useEffect } from "react";

export default function Home() {
  const [searchType, setSearchType] = useState("index");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [totalRecords, setTotalRecords] = useState(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then((data) => setTotalRecords(data.totalRecords))
      .catch(() => setTotalRecords(0));
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
        <div className="w-full max-w-xl">
          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-bold tracking-tight text-accent">
                NF Search
              </h1>
              {totalRecords !== null && (
                <span className="text-xs font-mono px-2 py-1 rounded-full border border-border text-text-secondary">
                  {totalRecords.toLocaleString()} records
                </span>
              )}
            </div>
            <p className="text-text-secondary text-sm">
              Search the Netflix movie dataset by index or title.
            </p>
          </div>

          {/* Segmented Toggle */}
          <div className="flex gap-1 p-1 rounded-lg bg-surface border border-border mb-4">
            <button
              onClick={() => setSearchType("index")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                searchType === "index"
                  ? "bg-white text-black"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Search by Index
            </button>
            <button
              onClick={() => setSearchType("name")}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                searchType === "name"
                  ? "bg-white text-black"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Search by Name
            </button>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-8">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                searchType === "index"
                  ? "Enter movie index (e.g. 1)"
                  : "Enter movie title (e.g. Dinosaur Planet)"
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

          {/* Result Card */}
          {result && (
            <div
              className="bg-surface border border-border rounded-lg p-6"
              style={{ animation: "fade-in 0.3s ease-out" }}
            >
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                    Index
                  </p>
                  <p className="text-lg font-mono font-medium">{result.index}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                    Title
                  </p>
                  <p className="text-lg font-medium">{result.name}</p>
                </div>
                <div>
                  <p className="text-xs text-text-secondary mb-1 uppercase tracking-wider">
                    Year
                  </p>
                  <p className="text-lg font-mono font-medium">{result.year}</p>
                </div>
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
          NF Search &middot; Netflix Movie Dataset Explorer
        </p>
      </footer>
    </div>
  );
}
