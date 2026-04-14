import Link from "next/link";
import { notFound } from "next/navigation";
import { DistributionChart, TrendChart } from "@/components/chart-panels";
import { MovieActions } from "@/components/movie-actions";
import { PosterFrame } from "@/components/poster-frame";
import { parseIntegerParam } from "@/lib/api";
import { getMovieDetail } from "@/lib/recommendationService";

export const dynamic = "force-dynamic";

function MetaTag({ children }) {
  return (
    <span className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700">
      {children}
    </span>
  );
}

export default async function MoviePage({ params }) {
  const resolvedParams = await params;
  const movieId = parseIntegerParam(resolvedParams.movieId, "movieId", { min: 1 });

  let movie;
  try {
    movie = await getMovieDetail(movieId);
  } catch {
    notFound();
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[38px] border border-white/70 bg-white p-8 shadow-[0_34px_95px_rgba(29,78,216,0.12)]">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-4xl">
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
              Movie detail
            </p>
            <h1 className="mt-3 text-5xl font-semibold tracking-tight text-slate-950">
              {movie.title}
            </h1>
            <div className="mt-5 flex flex-wrap gap-3">
              {movie.genresList.map((genre) => (
                <MetaTag key={genre}>{genre}</MetaTag>
              ))}
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl bg-brand-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-brand-600">Average rating</p>
                <p className="mt-2 font-mono text-3xl font-semibold text-brand-900">
                  {movie.averageRating}
                </p>
              </div>
              <div className="rounded-3xl bg-slate-100 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Total ratings</p>
                <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">
                  {movie.totalRatings.toLocaleString()}
                </p>
              </div>
              <div className="rounded-3xl bg-amber-50 p-4">
                <p className="text-xs uppercase tracking-[0.2em] text-amber-600">User tags</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{movie.tags.length}</p>
              </div>
            </div>
            <div className="mt-6">
              <MovieActions movieId={movie.movieId} />
            </div>
          </div>

          <div className="w-full max-w-sm space-y-4">
            <PosterFrame
              title={movie.title}
              posterUrl={movie.posterUrl}
              priority
              sizes="(min-width: 1280px) 360px, (min-width: 768px) 50vw, 92vw"
              className="aspect-[2/3] w-full rounded-[32px]"
            />

            <div className="rounded-[32px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_22px_65px_rgba(15,23,42,0.28)]">
              <p className="font-mono text-xs uppercase tracking-[0.24em] text-amber-300">
                External references
              </p>
              <div className="mt-5 flex flex-col gap-3">
                {movie.imdbId ? (
                  <a
                    href={`https://www.imdb.com/title/tt${movie.imdbId}/`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    Open IMDb
                  </a>
                ) : null}
                {movie.tmdbId ? (
                  <a
                    href={`https://www.themoviedb.org/movie/${movie.tmdbId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/15"
                  >
                    Open TMDB
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
            Rating distribution
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">How users rated it</h2>
          <div className="mt-5">
            <DistributionChart data={movie.ratingDistribution} />
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
            Trend
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Average rating by year</h2>
          <div className="mt-5">
            <TrendChart data={movie.ratingTrend} yDomain={[0, 5]} />
          </div>
        </div>
      </section>

      {movie.tags.length ? (
        <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">Tags</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Community descriptors</h2>
          <div className="mt-5 flex flex-wrap gap-3">
            {movie.tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
              Similar titles
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Content-neighbor shortlist</h2>
          </div>
          <Link
            href={`/discover?similarTo=${movie.movieId}`}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
          >
            Open discovery view
          </Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {movie.similarMovies.map((entry) => (
            <Link
              key={entry.movieId}
              href={`/movies/${entry.movieId}`}
              className="group rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-200 hover:bg-white"
            >
              <div className="grid gap-4 sm:grid-cols-[96px_1fr]">
                <PosterFrame
                  title={entry.title}
                  posterUrl={entry.posterUrl}
                  className="aspect-[2/3] min-h-[148px] w-full"
                />
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
                    Similarity {entry.similarity ? `${Math.round(entry.similarity * 100)}%` : "—"}
                  </p>
                  <h3 className="mt-3 text-xl font-semibold text-slate-950 transition group-hover:text-brand-700">
                    {entry.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{entry.genres}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {entry.reasonBadges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700"
                      >
                        {badge}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
