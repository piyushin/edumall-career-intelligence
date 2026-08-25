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
import { ApiError } from "../../../../lib/api";
import { canAccessGlobalRoute, hasPermission } from "../../../../lib/admin-authorization";
import { platformAdminApi, type OrganizationSummary } from "../../../../lib/platform-admin";

export default function OrganizationDetailPage() {
  const session = useAdminSession();
  const authorized = canAccessGlobalRoute(session, "organization.view");
  const assessments = hasPermission(session, "assessment.view");
  const commerce = hasPermission(session, "commerce.view");
  const { organizationId } = useParams<{ organizationId: string }>();
  const [organization, setOrganization] = useState<OrganizationSummary | null>(null);
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
      setOrganization(await platformAdminApi.organization(organizationId));
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Organization could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [authorized, organizationId]);
  useEffect(() => {
    void load();
  }, [load]);
  if (loading)
    return (
      <PlatformRoute permission="organization.view">
        <LoadingSkeleton rows={6} />
      </PlatformRoute>
    );
  if (error)
    return (
      <PlatformRoute permission="organization.view">
        <ErrorState message={error} retry={() => void load()} />
      </PlatformRoute>
    );
  if (!organization)
    return (
      <PlatformRoute permission="organization.view">
        <EmptyState
          title="Organization not found"
          description="No authorized organization record was returned."
        />
      </PlatformRoute>
    );
  return (
    <PlatformRoute permission="organization.view">
      <div className="space-y-7">
        <PageHeader
          eyebrow="Organization detail"
          title={organization.name}
          description={`${organization.slug} · Created ${formatDate(organization.createdAt)}`}
        />
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Panel>
            <p className="text-sm text-slate-500">Status</p>
            <div className="mt-3">
              <StatusBadge value={organization.status} />
            </div>
          </Panel>
          <Panel>
            <p className="text-sm text-slate-500">Type</p>
            <p className="mt-2 text-2xl font-semibold">{organization.type}</p>
          </Panel>
          <Panel>
            <p className="text-sm text-slate-500">Members</p>
            <p className="mt-2 text-2xl font-semibold">
              {organization._count?.memberships ?? organization.memberCount ?? 0}
            </p>
            <p className="mt-1 text-xs text-slate-500">{organization.activeMemberCount} active</p>
          </Panel>
          <Panel>
            <p className="text-sm text-slate-500">Administrators</p>
            <p className="mt-2 text-2xl font-semibold">{organization.administratorCount}</p>
          </Panel>
        </div>
        <Panel>
          <h2 className="text-lg font-semibold text-slate-950">Launch operations summary</h2>
          <dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {assessments ? (
              <div>
                <dt className="text-sm text-slate-500">Assessment assignments</dt>
                <dd className="mt-1 text-xl font-semibold">
                  {organization._count?.assessmentAssignments ?? "—"}
                </dd>
              </div>
            ) : null}
            {commerce ? (
              <div>
                <dt className="text-sm text-slate-500">Customer orders</dt>
                <dd className="mt-1 text-xl font-semibold">
                  {organization._count?.commerceOrders ?? "—"}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-sm text-slate-500">Last updated</dt>
              <dd className="mt-1 text-sm font-medium">{formatDate(organization.updatedAt)}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs text-slate-500">
            This workspace is read-only. Organization mutations are not exposed by the approved
            R19.1 backend.
          </p>
        </Panel>
      </div>
    </PlatformRoute>
  );
}
