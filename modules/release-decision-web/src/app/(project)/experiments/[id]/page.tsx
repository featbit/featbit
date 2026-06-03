import { ExperimentDetailClient } from "./experiment-detail-client";

export default async function ExperimentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ExperimentDetailClient id={id} />;
}
