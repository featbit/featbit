import { FlagDiff } from "@features/safe/feature-flags/types/compare-flag";

export type FlagDiffRow = {
  key: keyof FlagDiff;
  label: string;
  selected: boolean;
  hasDiff: boolean;
  copyMode?: 'append' | 'overwrite'; // For individualTargeting and targetingRule
  render: any;
}
