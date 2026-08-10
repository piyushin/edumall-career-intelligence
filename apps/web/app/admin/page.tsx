import Link from "next/link";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold text-blue-700">Administration</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
          Career Intelligence Dashboard
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          The assessment management foundation is now available for controlled administrator
          workflows.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Link
          href="/admin/assessments"
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-blue-300 hover:shadow-md"
        >
          <p className="text-sm font-semibold text-blue-700">Assessment library</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">Manage assessments</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            View assessment definitions, versions, lifecycle status and create new assessment
            definitions.
          </p>
        </Link>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm font-semibold text-slate-500">Next milestone</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-800">Assignment management</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Candidate assignment and delivery management will follow the assessment authoring
            workflow.
          </p>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
          <p className="text-sm font-semibold text-slate-500">Next milestone</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-800">Reports & counselling</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Report generation and counsellor workflows remain separate from scientific validation of
            assessment content.
          </p>
        </div>
      </div>
    </div>
  );
}
