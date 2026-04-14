import Image from "next/image";

function joinClasses(...values) {
  return values.filter(Boolean).join(" ");
}

export function PosterFrame({
  title,
  posterUrl,
  className = "",
  priority = false,
  sizes = "(min-width: 1280px) 200px, (min-width: 768px) 160px, 45vw",
}) {
  const initial = title?.trim()?.charAt(0)?.toUpperCase() || "M";

  return (
    <div
      className={joinClasses(
        "relative overflow-hidden rounded-[26px] border border-white/70 bg-[linear-gradient(160deg,rgba(15,23,42,0.96),rgba(30,41,59,0.88),rgba(29,78,216,0.55))] shadow-[0_18px_45px_rgba(15,23,42,0.18)]",
        className
      )}
    >
      {posterUrl ? (
        <Image
          src={posterUrl}
          alt={`${title} poster`}
          fill
          priority={priority}
          sizes={sizes}
          className="object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col justify-between bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.35),transparent_45%),linear-gradient(160deg,rgba(15,23,42,0.98),rgba(30,41,59,0.88))] p-5 text-white">
          <span className="font-mono text-[10px] uppercase tracking-[0.28em] text-white/65">
            Recommendation Studio
          </span>
          <div>
            <p className="text-4xl font-semibold tracking-tight text-white/95">{initial}</p>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-amber-300">
              Poster pending
            </p>
          </div>
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-slate-950/80 via-slate-950/10 to-transparent" />
    </div>
  );
}
