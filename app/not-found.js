import Link from "next/link";

export default function NotFound() {
  return (
    <div className="rounded-[38px] border border-white/70 bg-white p-10 text-center shadow-[0_28px_75px_rgba(148,163,184,0.14)]">
      <p className="font-mono text-xs uppercase tracking-[0.24em] text-brand-600">Not found</p>
      <h1 className="mt-4 text-4xl font-semibold text-slate-950">That resource is not in the dataset.</h1>
      <p className="mt-4 text-base leading-7 text-slate-600">
        Try a different user ID, movie ID, or return to the landing page to start from the main
        recommendation flows.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          href="/"
          className="rounded-full bg-brand-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-600"
        >
          Go home
        </Link>
        <Link
          href="/discover"
          className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-200 hover:text-brand-700"
        >
          Browse discover
        </Link>
      </div>
    </div>
  );
}
