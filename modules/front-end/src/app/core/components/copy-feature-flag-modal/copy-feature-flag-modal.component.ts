import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FeatureFlagService } from "@services/feature-flag.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { ProjectService } from "@services/project.service";
import { getCurrentProjectEnv } from "@utils/project-env";
import { IEnvironment } from "@shared/types";
import { CopyToEnvPrecheckResult, FeatureFlagListCheckItem } from "@features/safe/feature-flags/types/feature-flag";
import { map } from "rxjs/operators";

type BulkCopyCheckItem = {
  id: string;
  name: string;
  checked: boolean;
  disabled: boolean;
  active: boolean;
  keyCheck: boolean;
  targetUserCheck: boolean;
  targetRuleCheck: boolean;
  newProperties: string[];
  passed: boolean;
}

@Component({
  selector: 'copy-feature-flag-modal',
  templateUrl: './copy-feature-flag-modal.component.html',
  styleUrls: [ './copy-feature-flag-modal.component.less' ]
})
export class CopyFeatureFlagModalComponent implements OnInit {
  @Input()
  visible: boolean = false;

  private _flags: BulkCopyCheckItem[] = [];
  @Input()
  set flags(value: FeatureFlagListCheckItem[]) {
    this._flags = value.map(x => ({
        id: x.id,
        name: x.name,
        checked: false,
        disabled: true,
        active: false,
        keyCheck: false,
        targetUserCheck: false,
        targetRuleCheck: false,
        newProperties: [],
        passed: false
      }
    ));
  }

  get flags(): BulkCopyCheckItem[] {
    return this._flags;
  }

  @Output()
  close: EventEmitter<void> = new EventEmitter();

  targetEnvId: string = '';
  envs: IEnvironment[] = [];

  get selectedFlags() {
    return this.flags.filter(x => x.checked)
  }

  constructor(
    private projectService: ProjectService,
    private flagService: FeatureFlagService,
    private msg: NzMessageService,
  ) { }

  ngOnInit() {
    let currentProjectEnv = getCurrentProjectEnv();

    this.projectService
    .get(currentProjectEnv.projectId)
    .pipe(map(project => project.environments))
    .subscribe(envs => this.envs = envs.filter(x => x.id !== currentProjectEnv.envId));
  }

  onClose() {
    this.targetEnvId = '';

    this.checking = false;
    this.precheckResults = [];

    this.copying = false;

    this.close.emit();
  }

  checking: boolean = false;
  precheckResults: CopyToEnvPrecheckResult[] = [];

  onSelectTargetEnvironment() {
    this.checking = true;

    const flagIds = this.flags.map(x => x.id);

    this.flagService.copyToEnvPrecheck(this.targetEnvId, flagIds).subscribe({
      next: precheckResults => {
        this.precheckResults = precheckResults;

        this.flags.forEach(flag => {
          const precheckResult = precheckResults.find(x => x.id === flag.id);

          flag.active = !precheckResult.passed;
          flag.disabled = !precheckResult.keyCheck;
          flag.checked = precheckResult.passed;

          Object.assign(flag, precheckResult);
        });

        this.checking = false;
      },
      error: _ => {
        this.checking = false;
        this.msg.error($localize`:@@ff.bulk-copy.precheck-failed:Bulk copy precheck failed. Please try again.`);
      }
    });
  }

  copying: boolean = false;
  batchCopy() {
    if (this.precheckResults.length == 0) {
      return;
    }

    this.copying = true;

    const selectedFlagIds = this.selectedFlags.map(x => x.id);
    const precheckResults = this.precheckResults.filter(x => selectedFlagIds.includes(x.id));

    this.flagService.copyToEnv(this.targetEnvId, selectedFlagIds, precheckResults).subscribe({
      next: _ => {
        this.copying = false;
        this.msg.success($localize `:@@common.operation-success:Operation succeeded`);

        this.onClose();
      },
      error: _ => {
        this.msg.error($localize`:@@common.operation-failed:Operation failed`);
        this.copying = false;
      }
    });
  }
}
