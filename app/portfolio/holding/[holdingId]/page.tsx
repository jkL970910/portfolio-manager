import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/session";
import { getPortfolioHoldingDetailView } from "@/lib/backend/services";

export default async function PortfolioHoldingDetailPage({
  params
}: {
  params: Promise<{ holdingId: string }>;
}) {
  const viewer = await requireViewer();
  const { holdingId } = await params;
  const response = await getPortfolioHoldingDetailView(viewer.id, holdingId);
  const detail = response.data.data;

  if (!detail) {
    notFound();
  }

  redirect(
    `/portfolio/security/${encodeURIComponent(detail.holding.symbol)}?account=${encodeURIComponent(detail.holding.accountId)}&holding=${encodeURIComponent(detail.holding.id)}`
  );
}
