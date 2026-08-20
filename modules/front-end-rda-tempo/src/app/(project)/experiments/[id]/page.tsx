import { ExperimentDetailClient } from "./experiment-detail-client";

export default function ExperimentPage({
  params,
}: {
  params: { id: string };
}) {
  return <ExperimentDetailClient id={params.id} />;
}
