import Link from "next/link";
import { Button } from "@edumall/ui";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-6 py-12">
      <section className="space-y-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Phase 0</p>
        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-normal text-slate-950">
            EduMall Career Intelligence Platform
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-700">
            Engineering foundation is active. Product-domain workflows, assessments, scoring, and
            reports are intentionally not implemented in Phase 0.
          </p>
        </div>
        <Link href="/status">
          <Button>View service status</Button>
        </Link>
      </section>
    </main>
  );
}
