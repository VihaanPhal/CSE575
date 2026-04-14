import Link from "next/link";
import { getLandingData } from "@/lib/recommendationService";
import { LandingSearch } from "@/components/landing-search";
import { PosterFrame } from "@/components/poster-frame";

function ShowcaseCard({ title, description, href }) {
  return (
    <Link
      href={href}
      className="rounded-[28px] border border-white/70 bg-white/88 p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)] transition hover:-translate-y-1 hover:shadow-[0_26px_75px_rgba(29,78,216,0.14)]"
    >
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">Path</p>
      <h3 className="mt-3 text-2xl font-semibold text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </Link>
  );
}

function MovieStrip({ title, items, href }) {
  return (
    <section className="rounded-[32px] border border-white/70 bg-white/92 p-6 shadow-[0_22px_65px_rgba(148,163,184,0.14)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">Curated strip</p>
          <h2 className="mt-2 text-3xl font-semibold text-slate-950">{title}</h2>
        </div>
        <Link
          href={href}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
        >
          Open view
        </Link>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((movie) => (
          <Link
            key={movie.movieId}
            href={`/movies/${movie.movieId}`}
            className="group rounded-[24px] border border-slate-200 bg-slate-50 p-4 transition hover:border-brand-200 hover:bg-white"
          >
            <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
              <PosterFrame
                title={movie.title}
                posterUrl={movie.posterUrl}
                className="aspect-[2/3] min-h-[165px] w-full"
              />
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-slate-400">
                  {movie.model}
                </p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950 transition group-hover:text-brand-700">
                  {movie.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{movie.genres}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {movie.reasonBadges.map((badge) => (
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
  );
}

export default async function HomePage() {
  const data = await getLandingData();

  return (
    <div className="space-y-8">
      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-[38px] border border-white/70 bg-[linear-gradient(140deg,rgba(255,255,255,0.98),rgba(239,246,255,0.92))] p-8 shadow-[0_34px_90px_rgba(29,78,216,0.16)]">
          <p className="font-mono text-xs uppercase tracking-[0.28em] text-brand-600">
            Recommendation product
          </p>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight text-slate-950 sm:text-6xl">
            A proper frontend for the recommender your backend already deserves.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600">
            This app now exposes cold-start onboarding, model switching, explanation surfaces,
            benchmark diagnostics, and a recommendation-oriented browse experience on top of the
            MovieLens stack.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-4">
            <div className="rounded-3xl bg-white px-4 py-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Users</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">
                {data.stats.totalUsers.toLocaleString()}
              </p>
            </div>
            <div className="rounded-3xl bg-white px-4 py-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Movies</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">
                {data.stats.totalMovies.toLocaleString()}
              </p>
            </div>
            <div className="rounded-3xl bg-white px-4 py-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Ratings</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">
                {data.stats.totalRatings.toLocaleString()}
              </p>
            </div>
            <div className="rounded-3xl bg-white px-4 py-5">
              <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Tags</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">
                {data.stats.totalTags.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <LandingSearch sampleUsers={data.sampleUsers} />
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        <ShowcaseCard
          title="Cold-start onboarding"
          description="Rate a compact interview set, infer a new-user vector, and show a personalized shortlist without requiring a numeric user ID."
          href="/onboarding"
        />
        <ShowcaseCard
          title="Existing-user workspace"
          description="Switch between content, explained simple, matrix factorization, wiZAN, and ensemble paths on the same profile."
          href={`/users/${data.sampleUsers[0]?.userId || 1}`}
        />
        <ShowcaseCard
          title="Benchmarks and analytics"
          description="Inspect dataset-wide distributions together with benchmark outputs and route-level recommender diagnostics."
          href="/analytics"
        />
      </section>

      <MovieStrip title="Popular with the crowd" items={data.popular} href="/discover?sort=popular" />
      <MovieStrip title="Hidden gems worth surfacing" items={data.hiddenGems} href="/discover?sort=hidden_gem" />

      <section className="rounded-[32px] border border-white/70 bg-white/90 p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
              Genre coverage
            </p>
            <h2 className="mt-2 text-3xl font-semibold text-slate-950">
              The dataset spans every major recommendation lane.
            </h2>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {data.topGenres.map((genre) => (
            <span
              key={genre.genre}
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-medium text-slate-700"
            >
              {genre.genre} · {genre.totalRatings.toLocaleString()} ratings
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
