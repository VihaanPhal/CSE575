export default function Loading() {
  return (
    <div className="grid gap-6">
      <div className="h-56 animate-pulse rounded-[38px] bg-white shadow-[0_18px_45px_rgba(148,163,184,0.12)]" />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="h-72 animate-pulse rounded-[32px] bg-white shadow-[0_18px_45px_rgba(148,163,184,0.12)]" />
        <div className="h-72 animate-pulse rounded-[32px] bg-white shadow-[0_18px_45px_rgba(148,163,184,0.12)]" />
        <div className="h-72 animate-pulse rounded-[32px] bg-white shadow-[0_18px_45px_rgba(148,163,184,0.12)]" />
      </div>
    </div>
  );
}
