"use client";

import Link from "next/link";
import { useLocalStorageState, toggleIdInList } from "@/components/client-storage";

export function MovieActions({ movieId }) {
  const [savedMovieIds, setSavedMovieIds] = useLocalStorageState("savedMovies", []);
  const isSaved = savedMovieIds.includes(movieId);

  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => setSavedMovieIds((current) => toggleIdInList(current, movieId))}
        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
          isSaved
            ? "bg-amber-400 text-slate-950"
            : "border border-slate-200 text-slate-700 hover:border-amber-300 hover:text-slate-950"
        }`}
      >
        {isSaved ? "Saved to shortlist" : "Save to shortlist"}
      </button>
      <Link
        href={`/discover?similarTo=${movieId}`}
        className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
      >
        Explore similar movies
      </Link>
    </div>
  );
}
