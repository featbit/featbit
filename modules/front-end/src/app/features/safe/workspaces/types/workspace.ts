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

export interface LicenseQuota {
  [key: string]: { quota: number; used: number };
}

const MOCK_DAILY_TREND: DailyTrendItem[] = [
  { date: 'Apr 01', newUsers: 914, flagEvaluations: 264_392, customMetrics: 10_331 },
  { date: 'Apr 02', newUsers: 967, flagEvaluations: 271_550, customMetrics: 10_918 },
  { date: 'Apr 03', newUsers: 986, flagEvaluations: 278_108, customMetrics: 11_247 },
  { date: 'Apr 04', newUsers: 641, flagEvaluations: 162_704, customMetrics: 6_309 },
  { date: 'Apr 05', newUsers: 596, flagEvaluations: 155_292, customMetrics: 5_982 },
  { date: 'Apr 06', newUsers: 901, flagEvaluations: 257_844, customMetrics: 10_112 },
  { date: 'Apr 07', newUsers: 938, flagEvaluations: 269_031, customMetrics: 10_544 },
  { date: 'Apr 08', newUsers: 959, flagEvaluations: 272_481, customMetrics: 10_877 },
  { date: 'Apr 09', newUsers: 992, flagEvaluations: 281_660, customMetrics: 11_312 },
  { date: 'Apr 10', newUsers: 973, flagEvaluations: 275_493, customMetrics: 10_991 },
  { date: 'Apr 11', newUsers: 619, flagEvaluations: 160_378, customMetrics: 6_144 },
  { date: 'Apr 12', newUsers: 603, flagEvaluations: 157_221, customMetrics: 6_035 },
  { date: 'Apr 13', newUsers: 925, flagEvaluations: 263_801, customMetrics: 10_486 },
  { date: 'Apr 14', newUsers: 948, flagEvaluations: 268_167, customMetrics: 10_739 },
  { date: 'Apr 15', newUsers: 978, flagEvaluations: 276_212, customMetrics: 11_068 },
];

export const WORKSPACE_USAGE_MOCK_DATA: WorkspaceUsage = {
  summary: {
    mau: 12_458,
    totalFlagEvaluations: 3_847_291,
    totalCustomMetrics: 156_723,
    prevMau: 11_203,
    prevFlagEvaluations: 3_521_880,
    prevCustomMetrics: 142_109,
  },
  dailyTrend: MOCK_DAILY_TREND,
  environmentUsages: [
    {
      orgName: 'Acme Corp',
      projectName: 'Web Platform',
      envName: 'Production',
      envId: 'env-prod-001',
      mau: 8_932,
      flagEvaluations: 2_541_873,
      customMetrics: 98_421,
    },
    {
      orgName: 'Acme Corp',
      projectName: 'Web Platform',
      envName: 'Staging',
      envId: 'env-stg-001',
      mau: 1_247,
      flagEvaluations: 523_418,
      customMetrics: 24_302,
    },
    {
      orgName: 'Acme Corp',
      projectName: 'Mobile App',
      envName: 'Production',
      envId: 'env-prod-002',
      mau: 2_104,
      flagEvaluations: 689_234,
      customMetrics: 30_912,
    },
    {
      orgName: 'Beta Labs',
      projectName: 'API Gateway',
      envName: 'Production',
      envId: 'env-prod-003',
      mau: 175,
      flagEvaluations: 92_766,
      customMetrics: 3_088,
    },
  ],
};
