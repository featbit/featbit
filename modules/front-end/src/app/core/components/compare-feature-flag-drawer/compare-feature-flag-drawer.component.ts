import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { getCurrentLicense, getCurrentProjectEnv } from '@utils/project-env';
import { NzMessageService } from 'ng-zorro-antd/message';
import { FeatureFlagService } from "@services/feature-flag.service";
import { CompareFlagDetail } from "@features/safe/feature-flags/types/compare-flag";
import { finalize } from "rxjs/operators";
import { IEnvironment, IProject, LicenseFeatureEnum } from "@shared/types";
import { ProjectService } from "@services/project.service";
import { FlagDiffRow } from "@core/components/compare-feature-flag-drawer/types";
import { RenderOnOffState } from "@core/components/compare-feature-flag-drawer/render-on-off-state";
import { RenderIndividualTargeting } from "@core/components/compare-feature-flag-drawer/render-individual-targeting";
import { RenderTargetRules } from "@core/components/compare-feature-flag-drawer/render-target-rules.component";
import { RenderDefaultRule } from "@core/components/compare-feature-flag-drawer/render-default-rule";
import { RenderOffVariation } from "@core/components/compare-feature-flag-drawer/render-off-variation";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import {
  getAppliedDefaultRule,
  getAppliedOffVariation,
  getAppliedTargetRules,
  getAppliedTargetUsers
} from "@core/components/compare-feature-flag-drawer/utils";

type Env = {
  id: string,
  name: string
}

@Component({
  selector: 'compare-feature-flag-drawer',
  standalone: false,
  templateUrl: './compare-feature-flag-drawer.component.html',
  styleUrl: './compare-feature-flag-drawer.component.less'
})
export class CompareFeatureFlagDrawerComponent {
  private flagService: FeatureFlagService = inject(FeatureFlagService);
  private projectService: ProjectService = inject(ProjectService);
  private message: NzMessageService = inject(NzMessageService);

  private _visible: boolean = false;
  @Input()
  get visible(): boolean {
    return this._visible;
  }
  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.init().then();
    }
  }

  @Input()
  flag: {name: string, key: string};

  @Input()
  set targetEnv(value: Env) {
    if (value) {
      this.isTargetEnvLocked = true;
      this.selectedTargetEnvId = value.id;
      this.loadDiff();
    }
  }

  @Output()
  close: EventEmitter<boolean> = new EventEmitter();

  selectedTargetEnvId: string = '';
  isTargetEnvLocked: boolean = false;
  get targetEnv(): Env | null {
    const targetEnv =
      this.envs.find(env => env.value === this.selectedTargetEnvId) || null;
    if (targetEnv) {
      return {
        id: targetEnv.value,
        name: targetEnv.label
      }
    }

    return null;
  }

  isLoadingEnvs: boolean = true;
  envs: {label: string, value: string}[] = [];
  async loadEnvs() {
    const currentEnv = getCurrentProjectEnv();

    this.isLoadingEnvs = true;
    const projects = await this.projectService.getListAsync();
    this.envs = projects.flatMap((project: IProject) =>
      project.environments.map((env: IEnvironment) => ({
        value: env.id,
        label: `${project.name}/${env.name}`
      }))
    )
    .filter(env => env.value !== currentEnv.envId);

    this.isLoadingEnvs = false;
  }

  detail: CompareFlagDetail;
  isLoadingDiff: boolean = false;
  targetFlagNotExists: boolean = true;
  loadDiff() {
    if (!this.isCompareGranted) {
      return;
    }

    this.isLoadingDiff = true;
    this.targetFlagNotExists = false;
    this.flagService.compareFlag(this.selectedTargetEnvId, this.flag.key)
    .pipe(finalize(() => this.isLoadingDiff = false))
    .subscribe({
      next: (detail) => {
        this.detail = detail;
        if (!detail) {
          this.targetFlagNotExists = true;
          return;
        }

        this.initRows();
      },
      error: () => this.message.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`)
    })
  }

  sourceEnv: Env;
  isCompareGranted: boolean = false;
  async init() {
    const currentEnv = getCurrentProjectEnv();
    this.sourceEnv = {
      id: currentEnv.envId,
      name: `${currentEnv.projectName}/${currentEnv.envName}`
    };

    const license = getCurrentLicense();
    this.isCompareGranted = license.isGranted(LicenseFeatureEnum.FlagComparison);

    await this.loadEnvs();
  }

  onTargetEnvChange() {
    if (this.selectedTargetEnvId) {
      this.loadDiff();
    }
  }

  rows: FlagDiffRow[] = [];
  initRows() {
    const { onOffState, individualTargeting, targetingRule, defaultRule, offVariation } = this.detail.diff;

    this.rows = [
      {
        key: 'onOffState',
        label: $localize`:@@ff.compare.on-off-state:On/OFF State`,
        selected: false,
        hasDiff: onOffState.isDifferent,
        render: RenderOnOffState
      },
      {
        key: 'individualTargeting',
        label: $localize`:@@ff.compare.individual-targeting:Individual Targeting`,
        selected: false,
        hasDiff: individualTargeting.some(item => item.isDifferent),
        copyMode: 'overwrite',
        render: RenderIndividualTargeting
      },
      {
        key: 'targetingRule',
        label: $localize`:@@ff.compare.targeting-rules:Targeting Rules`,
        selected: false,
        hasDiff: targetingRule.some(item => item.isDifferent),
        copyMode: 'overwrite',
        render: RenderTargetRules
      },
      {
        key: 'defaultRule',
        label: $localize`:@@ff.compare.default-rule:Default Rule`,
        selected: false,
        hasDiff: defaultRule.isDifferent,
        render: RenderDefaultRule
      },
      {
        key: 'offVariation',
        label: $localize`:@@ff.compare.off-variation:Off Variation`,
        selected: false,
        hasDiff: offVariation.isDifferent,
        render: RenderOffVariation
      }
    ]
  }

  getAppliedFlag(row: FlagDiffRow): IFeatureFlag {
    const { source, target, diff } = this.detail;
    if (row.key === 'onOffState') {
      return {
        ...target,
        isEnabled: source.isEnabled
      }
    }

    const missingVariationsInTarget = source.variations.filter(sv =>
      !target.variations.some(tv => tv.value === sv.value)
    );
    const targetVariationsIfApplied = [ ...target.variations, ...missingVariationsInTarget ];

    if (row.key === 'individualTargeting') {
      const targetUsers = getAppliedTargetUsers(source, target, targetVariationsIfApplied, row.copyMode);

      return {
        ...target,
        variations: targetVariationsIfApplied,
        targetUsers
      }
    }

    if (row.key === 'targetingRule') {
      return {
        ...target,
        variations: targetVariationsIfApplied,
        rules: getAppliedTargetRules(source, target, diff.targetingRule, row.copyMode)
      }
    }

    if (row.key === 'defaultRule') {
      return {
        ...target,
        variations: targetVariationsIfApplied,
        fallthrough: getAppliedDefaultRule(source, targetVariationsIfApplied)
      }
    }

    if (row.key === 'offVariation') {
      return {
        ...target,
        disabledVariationId: getAppliedOffVariation(source, targetVariationsIfApplied)
      }
    }

    return target;
  }

  // Select all state
  get allSelected(): boolean {
    return this.rows.length > 0 && this.rows.every(row => row.selected);
  }

  get someSelected(): boolean {
    return this.rows.some(row => row.selected) && !this.allSelected;
  }

  get selectedCount(): number {
    return this.rows.filter(row => row.selected).length;
  }

  onSelectAll(checked: boolean) {
    this.rows
      .filter(row => row.hasDiff)
      .forEach(row => row.selected = checked);
  }

  isCopying: boolean = false;
  copySettings() {
    if (this.selectedCount === 0) {
      this.message.warning($localize`:@@ff.compare.select-settings-to-copy:Please select at least one setting to copy`);
      return;
    }

    this.isCopying = true;

    this.flagService.copySettings(this.selectedTargetEnvId, this.flag.key, {
      onOffState: this.rows[0].selected,
      individualTargeting: {
        copy: this.rows[1].selected,
        mode: this.rows[1].copyMode
      },
      targetingRule: {
        copy: this.rows[2].selected,
        mode: this.rows[2].copyMode
      },
      defaultRule: this.rows[3].selected,
      offVariation: this.rows[4].selected
    })
    .pipe(finalize(() => this.isCopying = false))
    .subscribe({
      next: () => {
        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
        this.onClose(false);
      },
      error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
    })
  }

  onClose(canceled: boolean) {
    this.selectedTargetEnvId = '';
    this.close.emit();
  }
}
