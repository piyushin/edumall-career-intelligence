"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@edumall/ui";
import { PlatformRoute } from "../../components/admin-route";
import { useAdminSession } from "../../components/admin-session";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
  formatDate,
} from "../../components/admin-ui";
import { ApiError } from "../../lib/api";
import { canAccessGlobalRoute } from "../../lib/admin-authorization";
import { platformAdminApi, type DashboardSummary } from "../../lib/platform-admin";

function Metric({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <Panel>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
        {new Intl.NumberFormat("en-IN").format(value)}
      </p>
      {note ? <p className="mt-2 text-xs text-slate-500">{note}</p> : null}
    </Panel>
  );
}

export default function AdminDashboardPage() {
  const session = useAdminSession();
  const authorized = canAccessGlobalRoute(session, "admin.view");
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    if (!authorized) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setData(await platformAdminApi.dashboard());
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "The dashboard could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authorized]);
  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PlatformRoute permission="admin.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Overview"
          title="Platform dashboard"
          description="A permission-aware operational view of users, organizations, administration, assessment delivery and commerce."
          actions={
            <Button variant="secondary" disabled={loading} onClick={() => void load()}>
              Refresh
            </Button>
          }
        />
        {loading ? (
          <LoadingSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} retry={() => void load()} />
        ) : !data ? (
          <EmptyState
            title="No dashboard data"
            description="The platform returned no summary information."
          />
        ) : (
          <>
            <p className="text-xs text-slate-500">Last refreshed {formatDate(data.generatedAt)}</p>
            <section
              aria-label="Platform metrics"
              className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
            >
              <Metric label="Total users" value={data.users.total} />
              <Metric label="Active users" value={data.users.active} />
              <Metric label="Organizations" value={data.organizations.total} />
              <Metric label="Active organizations" value={data.organizations.active} />
              <Metric
                label="Platform administrators"
                value={data.administrators.platformSuperAdmins}
              />
              <Metric
                label="Delegated administrators"
                value={data.administrators.delegatedActive}
              />
              {data.candidates ? <Metric label="Candidates" value={data.candidates.total} /> : null}
              {data.assessments ? (
                <Metric
                  label="Assessment assignments"
                  value={data.assessments.assignments}
                  note={`${data.assessments.attempts.submitted} submitted · ${data.assessments.reports.awaitingRelease} awaiting report`}
                />
              ) : null}
              {data.commerce ? (
                <>
                  <Metric
                    label="Paid orders"
                    value={data.commerce.paidOrders}
                    note={`${data.commerce.orders} total orders`}
                  />
                  <Metric label="Active entitlements" value={data.commerce.activeEntitlements} />
                </>
              ) : null}
            </section>
            {data.assessments ? (
              <Panel>
                <h2 className="text-lg font-semibold text-slate-950">
                  Assessment and report state
                </h2>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <dt className="text-xs text-slate-500">In progress</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {data.assessments.attempts.inProgress}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Submitted</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {data.assessments.attempts.submitted}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Reports released</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {data.assessments.reports.released}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-slate-500">Awaiting release</dt>
                    <dd className="mt-1 text-xl font-semibold">
                      {data.assessments.reports.awaitingRelease}
                    </dd>
                  </div>
                </dl>
              </Panel>
            ) : null}
            <Panel>
              <h2 className="text-lg font-semibold text-slate-950">
                Recent administrative and security activity
              </h2>
              {!data.recentActivity?.length ? (
                <div className="mt-4">
                  <EmptyState
                    title="No recent activity"
                    description="No authorized recent audit events were returned."
                  />
                </div>
              ) : (
                <div className="mt-4 divide-y divide-slate-100">
                  {data.recentActivity.map((event) => (
                    <article
                      key={event.id}
                      className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{event.action}</p>
                        <p className="text-xs text-slate-500">
                          {event.entityType}
                          {event.entityId ? ` · ${event.entityId}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge value={event.outcome} />
                        <time className="text-xs text-slate-500">
                          {formatDate(event.createdAt)}
                        </time>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Panel>
          </>
        )}
      </div>
    </PlatformRoute>
  );
}
