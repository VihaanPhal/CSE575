import "./globals.css";
import { AppNav } from "@/components/app-nav";

export const metadata = {
  title: "Recommendation Studio",
  description:
    "A full-stack MovieLens recommendation system with cold-start onboarding, model comparison, explainability, and analytics.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-app text-slate-950">
          <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(245,158,11,0.12),transparent_24%)]" />
          <AppNav />
          <main className="relative mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
            {children}
          </main>
          <footer className="relative border-t border-slate-200/80 bg-white/80">
            <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-slate-500 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
              <p>Recommendation Studio for CSE575 · Frontend, API bridge, and model diagnostics.</p>
              <p className="font-mono text-xs uppercase tracking-[0.22em] text-slate-400">
                Next.js · MovieLens · Python bridge
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
