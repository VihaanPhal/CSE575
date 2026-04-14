import { notFound } from "next/navigation";
import { parseIntegerParam } from "@/lib/api";
import { getUserWorkspace, SUPPORTED_MODELS } from "@/lib/recommendationService";
import { UserWorkspaceClient } from "@/components/user-workspace-client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function UserPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const userId = parseIntegerParam(resolvedParams.userId, "userId", { min: 1 });
  const model = SUPPORTED_MODELS.includes(resolvedSearchParams.model)
    ? resolvedSearchParams.model
    : "content";

  let workspace;
  try {
    workspace = await getUserWorkspace(userId, { model, limit: 12 });
  } catch {
    notFound();
  }

  return <UserWorkspaceClient workspace={workspace} />;
}
