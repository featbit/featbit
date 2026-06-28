export interface Activity {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  actorId: string | null;
  actorName: string | null;
  actorEmail: string | null;
  actorType: string | null;
  createdAt: Date;
  experimentId: string;
}

export interface Layer {
  id: string;
  featbitEnvId: string | null;
  name: string;
  key: string;
  description: string | null;
  assignmentUnitSelector: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Experiment {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  hypothesis: string | null;
  accessToken: string | null;
  change: string | null;
  constraints: string | null;
  description: string | null;
  envSecret: string | null;
  flagKey: string | null;
  flagServerUrl: string | null;
  goal: string | null;
  guardrails: string | null;
  intent: string | null;
  lastAction: string | null;
  lastLearning: string | null;
  name: string;
  openQuestions: string | null;
  primaryMetric: string | null;
  sandboxId: string | null;
  sandboxStatus: string | null;
  stage: string;
  variants: string | null;
  featbitProjectKey: string | null;
  featBitProjectKey?: string | null;
  featbitEnvId: string | null;
  featBitEnvId?: string | null;
  conflictAnalysis: string | null;
  entryMode: string | null;
  runCount?: number;
  runMethodSummary?: string | null;
}

export interface ExperimentRun {
  id: string;
  experimentId: string;
  slug: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  hypothesis: string | null;
  method: string | null;
  methodReason: string | null;
  primaryMetricEvent: string | null;
  metricDescription: string | null;
  guardrailEvents: string | null;
  guardrailDescriptions: string | null;
  controlVariant: string | null;
  treatmentVariant: string | null;
  trafficAllocation: string | null;
  minimumSample: number | null;
  observationStart: Date | null;
  observationEnd: Date | null;
  priorProper: boolean;
  priorMean: number | null;
  priorStddev: number | null;
  inputData: string | null;
  analysisResult: string | null;
  decision: string | null;
  decisionSummary: string | null;
  decisionReason: string | null;
  whatChanged: string | null;
  whatHappened: string | null;
  confirmedOrRefuted: string | null;
  whyItHappened: string | null;
  nextHypothesis: string | null;
  runId: string | null;
  primaryMetricAgg: string | null;
  primaryMetricType: string | null;
  trafficPercent: number | null;
  layerId: string | null;
  layerKey: string | null;
  allocationKeySelector: string | null;
  sliceStart: number | null;
  sliceEnd: number | null;
  allocationPlan: string | null;
  assignmentUnitSelector: string | null;
  layerTrafficPercent: number | null;
  analysisSamplingPlan: string | null;
  audienceFilters: string | null;
  trafficOffset: number | null;
  dataSourceMode: string | null;
  customerEndpointConfig: string | null;
}
