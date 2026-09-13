"use client";

import Link from "next/link";
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
  const reports = hasPermission(session, "report.search");
  const reportAccess = hasPermission(session, "report.credit.view");
  const counselling = hasPermission(session, "counsellor.assignment.view");
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
          eyebrow="Candidate 360"
          title={`${user.firstName} ${user.lastName}`}
          description={`${user.phoneE164 ?? "No mobile recorded"} · ${user.email} · User ID ${user.id}`}
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
                    <div>
                      <p className="font-semibold text-slate-900">
                        {assignment.assessmentVersion.title}
                      </p>
                      <p className="font-mono text-xs text-slate-500">
                        {assignment.assessmentVersion.assessmentDefinition.code} · v
                        {assignment.assessmentVersion.versionNumber}
                      </p>
                    </div>
                    <StatusBadge value={assignment.status} />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Assigned {formatDate(assignment.assignedAt)}
                  </p>
                  <div className="mt-3 space-y-3">
                    {assignment.attempts.map((attempt) => (
                      <article
                        key={attempt.id}
                        className="rounded-xl border border-slate-200 p-4 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap gap-2">
                            <StatusBadge value={attempt.status} />
                            {attempt.reportGeneration ? (
                              <StatusBadge value={attempt.reportGeneration.status} />
                            ) : (
                              <StatusBadge value="PENDING" />
                            )}
                          </div>
                          {reports ? (
                            <Link
                              href={`/admin/reports/${attempt.id}`}
                              className="font-medium text-red-700 hover:underline"
                            >
                              Open report record
                            </Link>
                          ) : null}
                        </div>
                        <p className="mt-3 text-xs text-slate-500">
                          Started {formatDate(attempt.startedAt)} · Submitted{" "}
                          {formatDate(attempt.submittedAt)}
                        </p>
                        <div className="mt-3 grid gap-2 sm:grid-cols-3">
                          <p className="text-xs text-slate-600">
                            Short result:{" "}
                            {attempt.reportGeneration?.status === "GENERATED"
                              ? "Available"
                              : "Processing"}
                          </p>
                          <p className="text-xs text-slate-600">
                            Detailed report:{" "}
                            {attempt.reportGeneration?.reportDataSnapshotId
                              ? "Generated"
                              : "Not generated yet"}
                          </p>
                          {commerce ? (
                            <p className="text-xs text-slate-600">
                              Candidate access:{" "}
                              {attempt.commerceEntitlements?.[0]?.status === "ACTIVE"
                                ? "Unlocked"
                                : "Locked"}
                            </p>
                          ) : null}
                        </div>
                        {attempt.reportGeneration?.lastErrorMessage ? (
                          <p className="mt-3 text-xs text-red-700">
                            {attempt.reportGeneration.lastErrorMessage}
                          </p>
                        ) : null}
                        {attempt.reportReleases?.length ? (
                          <details className="mt-3 text-xs text-slate-500">
                            <summary className="cursor-pointer font-medium">
                              Legacy release history
                            </summary>
                            <ul className="mt-2 space-y-1">
                              {attempt.reportReleases.map((release) => (
                                <li key={release.id}>
                                  Historical record dated {formatDate(release.releasedAt)}
                                </li>
                              ))}
                            </ul>
                          </details>
                        ) : null}
                      </article>
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
                        {order.couponCodeSnapshot ? (
                          <p className="mt-1 text-xs text-slate-500">
                            Coupon: {order.couponCodeSnapshot}
                          </p>
                        ) : null}
                        {order.payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="mt-2 flex items-center justify-between text-xs text-slate-600"
                          >
                            <span>
                              {payment.provider} · {payment.method.replaceAll("_", " ")}
                            </span>
                            <StatusBadge value={payment.status} />
                          </div>
                        ))}
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
        {reportAccess ? (
          <Panel>
            <h2 className="text-lg font-semibold">Report credits & access</h2>
            <p className="mt-1 text-sm text-slate-600">
              Active and historical third-party grants are independent from candidate access.
            </p>
            {user.assignedAssessments?.some((assignment) =>
              assignment.attempts.some((attempt) => attempt.reportAccessGrants?.length),
            ) ? (
              <div className="mt-4 space-y-3">
                {user.assignedAssessments.flatMap((assignment) =>
                  assignment.attempts.flatMap((attempt) =>
                    (attempt.reportAccessGrants ?? []).map((grant) => (
                      <div
                        key={grant.id}
                        className="rounded-xl border border-slate-200 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <strong>
                            {grant.principalOrganization?.name ??
                              (grant.principalUser
                                ? `${grant.principalUser.firstName} ${grant.principalUser.lastName}`
                                : grant.principalType)}
                          </strong>
                          <StatusBadge value={grant.status} />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">
                          {grant.source} · Granted {formatDate(grant.grantedAt)}
                        </p>
                      </div>
                    )),
                  ),
                )}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No report-access grants returned.</p>
            )}
          </Panel>
        ) : null}
        {counselling ? (
          <Panel>
            <h2 className="text-lg font-semibold">Counselling</h2>
            {user.candidateCounsellorAssignments?.length ? (
              <div className="mt-4 space-y-3">
                {user.candidateCounsellorAssignments.map((assignment) => (
                  <div
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-3"
                  >
                    <div>
                      <p className="font-medium">
                        {assignment.counsellorUser.firstName} {assignment.counsellorUser.lastName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {assignment.organization.name} · Assigned{" "}
                        {formatDate(assignment.assignedAt)}
                      </p>
                    </div>
                    <StatusBadge value={assignment.status} />
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-500">No counsellor assignments returned.</p>
            )}
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
