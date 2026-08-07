import type { HealthResponse } from "@edumall/shared-types";

function getStatus(): HealthResponse {
  return {
    environment: process.env.NEXT_PUBLIC_APP_ENV ?? "local",
    service: "web",
    status: "ok",
    timestamp: new Date().toISOString(),
    version: process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0-local",
  };
}

export default function StatusPage() {
  const status = getStatus();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col justify-center px-6 py-12">
      <section className="space-y-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-blue-700">Status</p>
          <h1 className="mt-2 text-3xl font-semibold text-slate-950">Web service health</h1>
        </div>
        <dl className="grid gap-4 sm:grid-cols-2">
          <StatusItem label="Service" value={status.service} />
          <StatusItem label="Environment" value={status.environment} />
          <StatusItem label="Version" value={status.version} />
          <StatusItem label="State" value={status.status} />
        </dl>
      </section>
    </main>
  );
}

function StatusItem({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-slate-200 p-4">
      <dt className="text-sm font-medium text-slate-600">{label}</dt>
      <dd className="mt-1 text-base font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
