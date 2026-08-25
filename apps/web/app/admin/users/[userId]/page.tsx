"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PlatformRoute } from "../../../../components/admin-route";
import { useAdminSession } from "../../../../components/admin-session";
import {
  EmptyState,
  ErrorState,
  LoadingSkeleton,
  PageHeader,
  Panel,
  StatusBadge,
  formatDate,
} from "../../../../components/admin-ui";
import { canAccessGlobalRoute, hasPermission } from "../../../../lib/admin-authorization";
import { ApiError } from "../../../../lib/api";
import { platformAdminApi, type UserSummary } from "../../../../lib/platform-admin";

export default function UserDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const session = useAdminSession();
  const authorized = canAccessGlobalRoute(session, "candidate.view");
  const commerce = hasPermission(session, "commerce.view");
  const administration = hasPermission(session, "admin.view");
  const [user, setUser] = useState<UserSummary | null>(null);
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
      setUser(await platformAdminApi.user(userId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "User detail could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authorized, userId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading)
    return (
      <PlatformRoute permission="candidate.view">
        <LoadingSkeleton rows={8} />
      </PlatformRoute>
    );
  if (error)
    return (
      <PlatformRoute permission="candidate.view">
        <ErrorState message={error} retry={() => void load()} />
      </PlatformRoute>
    );
  if (!user)
    return (
      <PlatformRoute permission="candidate.view">
        <EmptyState title="User not found" description="No authorized user record was returned." />
      </PlatformRoute>
    );
  return (
    <PlatformRoute permission="candidate.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Customer support"
          title={`${user.firstName} ${user.lastName}`}
          description={`${user.email} · User ID ${user.id}`}
        />
        <div className="grid gap-5 md:grid-cols-4">
          <Panel>
            <p className="text-sm text-slate-500">Account status</p>
            <div className="mt-3">
              <StatusBadge value={user.status} />
            </div>
          </Panel>
          <Panel>
            <p className="text-sm text-slate-500">Candidate segment</p>
            <p className="mt-2 font-semibold">
              {user.candidateSegment?.replaceAll("_", " ") ?? "Not recorded"}
            </p>
          </Panel>
          <Panel>
            <p className="text-sm text-slate-500">Email verification</p>
            <p className="mt-2 font-semibold">
              {user.emailVerifiedAt ? formatDate(user.emailVerifiedAt) : "Not verified"}
            </p>
          </Panel>
          <Panel>
            <p className="text-sm text-slate-500">Last login</p>
            <p className="mt-2 font-semibold">{formatDate(user.lastLoginAt)}</p>
          </Panel>
        </div>
        <Panel>
          <h2 className="text-lg font-semibold">Memberships</h2>
          {user.memberships.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {user.memberships.map((membership) => (
                <div
                  key={membership.id}
                  className="flex flex-col justify-between gap-2 py-3 sm:flex-row sm:items-center"
                >
                  <div>
                    <p className="font-medium">{membership.organization.name}</p>
                    <p className="text-xs text-slate-500">
                      {membership.organization.type} · {membership.organization.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge value={membership.role} />
                    <StatusBadge value={membership.status} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No memberships"
              description="No membership is available in this authorized projection."
            />
          )}
        </Panel>
        <Panel>
          <h2 className="text-lg font-semibold">Career Intelligence</h2>
          <p className="mt-1 text-sm text-slate-600">
            Assessment and report lifecycle summary. Raw answers and unrestricted metadata are not
            shown.
          </p>
          {user.assignedAssessments?.length ? (
            <div className="mt-4 divide-y divide-slate-100">
              {user.assignedAssessments.map((assignment) => (
                <div key={assignment.id} className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-mono text-xs text-slate-500">{assignment.id}</p>
                    <StatusBadge value={assignment.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Assigned {formatDate(assignment.assignedAt)}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {assignment.attempts.map((attempt) => (
                      <span
                        key={attempt.id}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-xs"
                      >
                        Attempt: {attempt.status} · Report{" "}
                        {attempt._count.reportReleases > 0 ? "released" : "not released"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No assessment history"
                description="No assessment assignment was returned."
              />
            </div>
          )}
        </Panel>
        {commerce ? (
          <Panel>
            <h2 className="text-lg font-semibold">Commerce & entitlements</h2>
            <div className="mt-5 grid gap-6 lg:grid-cols-2">
              <section>
                <h3 className="text-sm font-semibold text-slate-700">Orders</h3>
                {user.commerceOrders?.length ? (
                  <div className="mt-2 space-y-2">
                    {user.commerceOrders.map((order) => (
                      <div key={order.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex justify-between gap-3">
                          <StatusBadge value={order.status} />
                          <strong>
                            {new Intl.NumberFormat("en-IN", {
                              style: "currency",
                              currency: order.currency,
                            }).format(order.totalMinor / 100)}
                          </strong>
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {formatDate(order.createdAt)} · {order.id}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No orders returned.</p>
                )}
              </section>
              <section>
                <h3 className="text-sm font-semibold text-slate-700">Entitlements</h3>
                {user.commerceEntitlements?.length ? (
                  <div className="mt-2 space-y-2">
                    {user.commerceEntitlements.map((entitlement) => (
                      <div key={entitlement.id} className="rounded-xl border border-slate-200 p-3">
                        <div className="flex justify-between gap-3">
                          <strong>{entitlement.type}</strong>
                          <StatusBadge value={entitlement.status} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          Granted {formatDate(entitlement.grantedAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-500">No entitlements returned.</p>
                )}
              </section>
            </div>
          </Panel>
        ) : null}
        {administration && user.adminProfile ? (
          <Panel>
            <h2 className="text-lg font-semibold">Administration</h2>
            <div className="mt-4 flex items-center gap-3">
              <StatusBadge value={user.adminProfile.status} />
              <span className="text-sm text-slate-600">
                {user.adminProfile.responsibility ??
                  user.adminProfile.title ??
                  "No responsibility label"}
              </span>
            </div>
            <div className="mt-4 space-y-2">
              {user.adminProfile.assignments.map((assignment) => (
                <div key={assignment.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                  <strong>{assignment.roleTemplate.name}</strong>
                  <span className="text-slate-500">
                    {" "}
                    · {assignment.scopeType === "PLATFORM" ? "Platform" : assignment.organizationId}
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        ) : null}
      </div>
    </PlatformRoute>
  );
}
