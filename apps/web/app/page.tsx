import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center bg-slate-950 px-6 py-16 text-white">
      <div className="mx-auto w-full max-w-6xl">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-300">
          The EduMall
        </p>
        <h1 className="mt-6 max-w-4xl text-5xl font-semibold tracking-tight sm:text-6xl">
          Career Intelligence Platform
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
          Secure assessment administration, candidate delivery, scoring and reporting infrastructure
          for the EduMall career ecosystem.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex min-h-11 items-center justify-center rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Administrator login
          </Link>
          <Link
            href="/status"
            className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-700 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:bg-slate-900"
          >
            Service status
          </Link>
        </div>
      </div>
    </main>
  );
}
