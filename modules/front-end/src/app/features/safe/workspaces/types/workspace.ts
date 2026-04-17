export interface WorkspaceUsage {
  summary: UsageSummary;
  dailyTrend: DailyTrendItem[];
  environmentUsages: EnvironmentUsage[];
}

export interface UsageSummary {
  mau: number;
  totalFlagEvaluations: number;
  totalCustomMetrics: number;
  prevMau: number;
  prevFlagEvaluations: number;
  prevCustomMetrics: number;
}

export interface DailyTrendItem {
  date: string;
  newUsers: number;
  flagEvaluations: number;
  customMetrics: number;
}

export interface EnvironmentUsage {
  orgName: string;
  projectName: string;
  envName: string;
  envId: string;
  mau: number;
  flagEvaluations: number;
  customMetrics: number;
}

export interface WorkspaceUsageFilter {
  startDate: string;
  endDate: string;
  prevStartDate: string;
  prevEndDate: string;
}

export interface LicenseQuota {
  [key: string]: { quota: number; used: number };
}
