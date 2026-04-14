import { DistributionChart, GenreBarChart, TrendChart } from "@/components/chart-panels";
import { getAnalyticsPayload } from "@/lib/recommendationService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  const payload = await getAnalyticsPayload();
  const benchmarkRows = Object.entries(payload.benchmarks.metrics);

  return (
    <div className="space-y-8">
      <section className="rounded-[38px] border border-white/70 bg-white p-8 shadow-[0_34px_90px_rgba(29,78,216,0.12)]">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
          Analytics and diagnostics
        </p>
        <h1 className="mt-3 text-5xl font-semibold tracking-tight text-slate-950">
          Dataset analytics plus recommender diagnostics
        </h1>
        <p className="mt-5 max-w-4xl text-lg leading-8 text-slate-600">
          The analytics surface now combines dataset coverage, rating behavior, and benchmark data
          from the Python evaluation harness. It is intended for demo narration and backend sanity
          checks, not just descriptive charts.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-4">
          {[
            ["Users", payload.stats.totalUsers.toLocaleString()],
            ["Movies", payload.stats.totalMovies.toLocaleString()],
            ["Ratings", payload.stats.totalRatings.toLocaleString()],
            ["Tags", payload.stats.totalTags.toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} className="rounded-3xl bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">{label}</p>
              <p className="mt-2 font-mono text-3xl font-semibold text-slate-950">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {payload.benchmarks.error ? (
        <section className="rounded-[28px] border border-rose-200 bg-rose-50 p-5 text-sm leading-7 text-rose-700">
          Benchmarks are currently unavailable: {payload.benchmarks.error}
        </section>
      ) : null}

      {payload.benchmarks.suspicious ? (
        <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
          The benchmark harness returned identical metrics for every model. That likely means the
          current evaluator is not differentiating the implementations correctly yet, so treat the
          table below as instrumentation output rather than proof of model equivalence.
        </section>
      ) : null}

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">
          Benchmark summary
        </p>
        <h2 className="mt-2 text-3xl font-semibold text-slate-950">
          Python evaluation harness output
        </h2>
        {benchmarkRows.length ? (
          <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-[0.18em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">RMSE</th>
                  <th className="px-4 py-3">MAE</th>
                  <th className="px-4 py-3">Bias</th>
                  <th className="px-4 py-3">Eval time</th>
                </tr>
              </thead>
              <tbody>
                {benchmarkRows.map(([model, metrics]) => (
                  <tr key={model} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-semibold text-slate-950">{model}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{metrics.RMSE.toFixed(4)}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{metrics.MAE.toFixed(4)}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {metrics.prediction_bias_mean.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {metrics.evaluation_time.toFixed(2)}s
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 text-sm leading-7 text-slate-600">
            No benchmark rows are available yet.
          </p>
        )}
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">Global ratings</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Distribution</h2>
          <div className="mt-5">
            <DistributionChart data={payload.ratingDistribution} />
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">Temporal behavior</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Average rating over time</h2>
          <div className="mt-5">
            <TrendChart data={payload.ratingsOverTime} yDomain={[2.5, 4.5]} />
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">Genre support</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Ratings by genre</h2>
          <div className="mt-5">
            <GenreBarChart data={payload.genreStats} dataKey="totalRatings" />
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_18px_55px_rgba(148,163,184,0.14)]">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">Genre quality</p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-950">Average rating by genre</h2>
          <div className="mt-5">
            <GenreBarChart
              data={[...payload.genreStats].toSorted((a, b) => b.averageRating - a.averageRating)}
              dataKey="averageRating"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
