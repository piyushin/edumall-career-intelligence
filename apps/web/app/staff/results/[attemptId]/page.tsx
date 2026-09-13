import { redirect } from "next/navigation";

export default async function LegacyResultDetailPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const { attemptId } = await params;
  redirect(`/staff/reports/${encodeURIComponent(attemptId)}`);
}
