export interface WorkspaceUsage {
  summary: UsageSummary;
  dailyTrend: DailyTrendItem[];
  environmentUsages: EnvironmentUsage[];
}

export interface UsageSummary {
  uniqueUsers: number;
  totalFlagEvaluations: number;
  totalCustomMetrics: number;
  prevUniqueUsers: number;
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
  uniqueUsers: number;
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
