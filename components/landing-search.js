"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorageState } from "@/components/client-storage";

export function LandingSearch({ sampleUsers }) {
  const router = useRouter();
  const [mode, setMode] = useState("user");
  const [query, setQuery] = useState("");
  const [, setRecentQueries] = useLocalStorageState("recentQueries", []);

  function handleSubmit(event) {
    event.preventDefault();
    if (!query.trim()) return;

    setRecentQueries((current) => {
      const next = [query.trim(), ...current.filter((entry) => entry !== query.trim())];
      return next.slice(0, 6);
    });

    startTransition(() => {
      if (mode === "user") {
        router.push(`/users/${query.trim()}?model=content`);
        return;
      }

      if (mode === "movie") {
        router.push(`/movies/${query.trim()}`);
        return;
      }

      router.push(`/discover?query=${encodeURIComponent(query.trim())}`);
    });
  }

  return (
    <div className="rounded-[32px] border border-white/70 bg-white/92 p-6 shadow-[0_28px_80px_rgba(29,78,216,0.14)] backdrop-blur-xl">
      <div className="mb-5 flex flex-wrap gap-2">
        {[
          { key: "user", label: "Existing user" },
          { key: "movie", label: "Movie detail" },
          { key: "discover", label: "Catalog browse" },
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setMode(option.key)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              mode === option.key
                ? "bg-brand-700 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            mode === "user"
              ? "Try user 414"
              : mode === "movie"
              ? "Try movie 1"
              : "Search by title or genre"
          }
          className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-base text-slate-950 outline-none transition focus:border-brand-400 focus:bg-white"
        />
        <button
          type="submit"
          className="min-h-12 rounded-2xl bg-amber-400 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
        >
          Launch flow
        </button>
      </form>

      <div className="mt-5 flex flex-wrap gap-2">
        {sampleUsers.map((user) => (
          <button
            key={user.userId}
            type="button"
            onClick={() => {
              setQuery(String(user.userId));
              setMode("user");
            }}
            className="rounded-full border border-slate-200 px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
          >
            User {user.userId} · {user.totalRatings} ratings
          </button>
        ))}
      </div>
    </div>
  );
}
