import { Component, EventEmitter, Input, Output } from '@angular/core';
import { getCurrentProjectEnv } from '@utils/project-env';
import { NzMessageService } from 'ng-zorro-antd/message';
import { copyToClipboard } from "@utils/index";

// Interfaces for the component
export interface CompareEnvironment {
  id: string;
  name: string;
  projectName: string;
  fullName: string;
}

export interface CompareFeatureFlag {
  id: string;
  name: string;
  key: string;
}

export interface IndividualTarget {
  variationName: string;
  users: string[];
}

export interface RuleCondition {
  property: string;
  operator: string;
  value: string;
}

export interface TargetingRule {
  conditions: RuleCondition[];
  serveType: 'percentage' | 'variation';
  serveValue: string; // variation name or percentage distribution
}

export interface FlagSettings {
  isEnabled: boolean;
  individualTargeting: IndividualTarget[];
  targetingRules: TargetingRule[];
  defaultRule: string; // variation name
  offVariation: string; // variation name
}

export interface DiffRow {
  key: 'isEnabled' | 'individualTargeting' | 'targetingRules' | 'defaultRule' | 'offVariation';
  label: string;
  selected: boolean;
  hasDiff: boolean;
}

@Component({
  selector: 'compare-feature-flag-drawer',
  standalone: false,
  templateUrl: './compare-feature-flag-drawer.component.html',
  styleUrl: './compare-feature-flag-drawer.component.less'
})
export class CompareFeatureFlagDrawerComponent {
  private _visible: boolean = false;

  @Input()
  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.initializeComponent();
    }
  }

  @Input()
  flag: CompareFeatureFlag;

  @Input()
  targetEnvironment: CompareEnvironment | null = null;

  @Output()
  close: EventEmitter<void> = new EventEmitter();

  // Source environment (current environment)
  sourceEnvironment: CompareEnvironment;

  // Available environments for selection
  availableEnvironments: CompareEnvironment[] = [];

  // Selected target environment ID (when targetEnvironment is not provided)
  selectedTargetEnvId: string = '';

  // Whether target environment can be changed
  get isTargetEnvLocked(): boolean {
    return this.targetEnvironment !== null;
  }

  // Current target environment (either from input or selected)
  get currentTargetEnv(): CompareEnvironment | null {
    if (this.targetEnvironment) {
      return this.targetEnvironment;
    }
    return this.availableEnvironments.find(env => env.id === this.selectedTargetEnvId) || null;
  }

  // Mock settings data
  targetEnvSettings: FlagSettings | null = null;
  sourceEnvSettings: FlagSettings | null = null;

  // Diff rows configuration
  diffRows: DiffRow[] = [];

  // Select all state
  get allSelected(): boolean {
    return this.diffRows.length > 0 && this.diffRows.every(row => row.selected);
  }

  get someSelected(): boolean {
    return this.diffRows.some(row => row.selected) && !this.allSelected;
  }

  get selectedCount(): number {
    return this.diffRows.filter(row => row.selected).length;
  }

  isLoading: boolean = false;
  isCopying: boolean = false;

  constructor(private msg: NzMessageService) {}

  initializeComponent() {
    // Reset state
    this.selectedTargetEnvId = '';
    this.targetEnvSettings = null;
    this.sourceEnvSettings = null;
    this.diffRows = [];

    // Get current environment as source
    const currentProjectEnv = getCurrentProjectEnv();
    this.sourceEnvironment = {
      id: currentProjectEnv?.envId || 'env-1',
      name: currentProjectEnv?.envName || 'Development',
      projectName: currentProjectEnv?.projectName || 'webapp',
      fullName: `${currentProjectEnv?.projectName || 'webapp'}/${currentProjectEnv?.envName || 'development'}`
    };

    // Mock available environments
    this.availableEnvironments = [
      { id: 'env-2', name: 'Staging', projectName: 'webapp', fullName: 'webapp/staging' },
      { id: 'env-3', name: 'Production', projectName: 'webapp', fullName: 'webapp/prod' },
      { id: 'env-4', name: 'Development', projectName: 'mobile-app', fullName: 'mobile-app/development' },
      { id: 'env-5', name: 'Production', projectName: 'mobile-app', fullName: 'mobile-app/prod' }
    ].filter(env => env.id !== this.sourceEnvironment.id);

    // If target environment is provided, load comparison data immediately
    if (this.targetEnvironment) {
      this.loadComparisonData();
    }
  }

  onTargetEnvChange() {
    if (this.selectedTargetEnvId) {
      this.loadComparisonData();
    }
  }

  loadComparisonData() {
    this.isLoading = true;

    // Simulate API call with mock data
    setTimeout(() => {
      this.generateMockData();
      this.initializeDiffRows();
      this.isLoading = false;
    }, 500);
  }

  generateMockData() {
    // Mock data for target environment (current settings)
    this.targetEnvSettings = {
      isEnabled: true,
      individualTargeting: [
        { variationName: 'Variation 1', users: [] },
        { variationName: 'Variation 2', users: ['user1', 'user2'] }
      ],
      targetingRules: [],
      defaultRule: 'Variation 1',
      offVariation: 'Variation 2'
    };

    // Mock data for source environment (settings to copy from)
    this.sourceEnvSettings = {
      isEnabled: false,
      individualTargeting: [
        { variationName: 'Variation 1', users: ['user1', 'user2'] },
        { variationName: 'Variation 2', users: [] }
      ],
      targetingRules: [
        {
          conditions: [{ property: 'user', operator: 'is one of', value: 'testing, betauser' }],
          serveType: 'percentage',
          serveValue: '10% Variation 1, 90% Variation 2'
        },
        {
          conditions: [{ property: 'email', operator: 'ends with', value: "'vip'" }],
          serveType: 'variation',
          serveValue: 'Variation 2'
        }
      ],
      defaultRule: 'Variation 2',
      offVariation: 'Variation 1'
    };
  }

  initializeDiffRows() {
    this.diffRows = [
      {
        key: 'isEnabled',
        label: $localize`:@@ff.compare.on-off-state:On/OFF State`,
        selected: false,
        hasDiff: this.targetEnvSettings?.isEnabled !== this.sourceEnvSettings?.isEnabled
      },
      {
        key: 'individualTargeting',
        label: $localize`:@@ff.compare.individual-targeting:Individual Targeting`,
        selected: false,
        hasDiff: this.hasIndividualTargetingDiff()
      },
      {
        key: 'targetingRules',
        label: $localize`:@@ff.compare.targeting-rules:Targeting Rules`,
        selected: false,
        hasDiff: this.hasTargetingRulesDiff()
      },
      {
        key: 'defaultRule',
        label: $localize`:@@ff.compare.default-rule:Default Rule`,
        selected: false,
        hasDiff: this.targetEnvSettings?.defaultRule !== this.sourceEnvSettings?.defaultRule
      },
      {
        key: 'offVariation',
        label: $localize`:@@ff.compare.off-variation:If flag is OFF, serve`,
        selected: false,
        hasDiff: this.targetEnvSettings?.offVariation !== this.sourceEnvSettings?.offVariation
      }
    ];
  }

  hasIndividualTargetingDiff(): boolean {
    if (!this.targetEnvSettings || !this.sourceEnvSettings) return false;
    return JSON.stringify(this.targetEnvSettings.individualTargeting) !==
           JSON.stringify(this.sourceEnvSettings.individualTargeting);
  }

  hasTargetingRulesDiff(): boolean {
    if (!this.targetEnvSettings || !this.sourceEnvSettings) return false;
    return JSON.stringify(this.targetEnvSettings.targetingRules) !==
           JSON.stringify(this.sourceEnvSettings.targetingRules);
  }

  onSelectAll(checked: boolean) {
    this.diffRows.forEach(row => row.selected = checked);
  }

  // Format individual targeting for display
  formatIndividualTargeting(targets: IndividualTarget[]): string[] {
    if (!targets || targets.length === 0) {
      return [$localize`:@@ff.compare.no-individual-targets:No individual targets`];
    }

    const lines: string[] = [];
    targets.forEach(target => {
      lines.push(`<strong>${target.variationName}</strong>`);
      if (target.users.length === 0) {
        lines.push($localize`:@@ff.compare.no-individual-targets:No individual targets`);
      } else {
        lines.push(target.users.join(', '));
      }
    });
    return lines;
  }

  // Format targeting rules for display
  formatTargetingRules(rules: TargetingRule[]): string[] {
    if (!rules || rules.length === 0) {
      return [$localize`:@@ff.compare.no-rules-defined:No rules defined`];
    }

    const lines: string[] = [];
    rules.forEach((rule, index) => {
      const conditionStr = rule.conditions.map(c => `${c.property} ${c.operator} ${c.value}`).join(' AND ');
      lines.push(`<strong>If</strong> ${conditionStr}`);
      if (rule.serveType === 'percentage') {
        lines.push(`serve <strong>${rule.serveValue}</strong>`);
      } else {
        lines.push(`serve <strong>${rule.serveValue}</strong>`);
      }
      if (index < rules.length - 1) {
        lines.push(''); // Empty line between rules
      }
    });
    return lines;
  }

  // Get display value for a setting
  getTargetDisplayValue(key: string): string[] {
    if (!this.targetEnvSettings) return [];

    switch (key) {
      case 'isEnabled':
        return [this.targetEnvSettings.isEnabled ? 'On' : 'Off'];
      case 'individualTargeting':
        return this.formatIndividualTargeting(this.targetEnvSettings.individualTargeting);
      case 'targetingRules':
        return this.formatTargetingRules(this.targetEnvSettings.targetingRules);
      case 'defaultRule':
        return [this.targetEnvSettings.defaultRule];
      case 'offVariation':
        return [this.targetEnvSettings.offVariation];
      default:
        return [];
    }
  }

  getSourceDisplayValue(key: string): string[] {
    if (!this.sourceEnvSettings) return [];

    switch (key) {
      case 'isEnabled':
        return [this.sourceEnvSettings.isEnabled ? 'On' : 'Off'];
      case 'individualTargeting':
        return this.formatIndividualTargeting(this.sourceEnvSettings.individualTargeting);
      case 'targetingRules':
        return this.formatTargetingRules(this.sourceEnvSettings.targetingRules);
      case 'defaultRule':
        return [this.sourceEnvSettings.defaultRule];
      case 'offVariation':
        return [this.sourceEnvSettings.offVariation];
      default:
        return [];
    }
  }

  copySettings() {
    if (this.selectedCount === 0) {
      this.msg.warning($localize`:@@ff.compare.select-settings-to-copy:Please select at least one setting to copy`);
      return;
    }

    this.isCopying = true;

    // Simulate API call
    setTimeout(() => {
      const selectedKeys = this.diffRows.filter(row => row.selected).map(row => row.label);
      this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
      this.isCopying = false;
      this.onClose();
    }, 1000);
  }

  copyText(event: any, text: string) {
    copyToClipboard(text).then(
      () => this.msg.success($localize `:@@common.copy-success:Copied`)
    );
  }

  onClose() {
    this._visible = false;
    this.close.emit();
  }
}
