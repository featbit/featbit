import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { FormsModule } from '@angular/forms';
import { NzDropDownModule } from "ng-zorro-antd/dropdown";
import { NzCheckboxModule } from "ng-zorro-antd/checkbox";
import { CoreModule } from "@core/core.module";
import { FeatureFlagService } from "@services/feature-flag.service";
import {
  CompareFlagOverviews,
  CompareFlagOverview,
  IFeatureFlagListFilter
} from "@features/safe/feature-flags/types/feature-flag";
import { NzMessageService } from "ng-zorro-antd/message";
import { debounceTime, finalize } from "rxjs/operators";
import { Subject } from "rxjs";
import { IEnvironment, IProject, IProjectEnv } from "@shared/types";
import { ProjectService } from "@services/project.service";
import { getCurrentProjectEnv } from "@utils/project-env";

type EnvironmentSelectOption = {
  label: string,
  value: string
}

type SelectableTag = {
  name: string,
  selected: boolean
}

@Component({
  selector: 'compare-flags',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    NzSelectModule,
    NzTableModule,
    NzIconModule,
    NzToolTipModule,
    NzTagModule,
    NzInputModule,
    NzButtonModule,
    NzSpinModule,
    NzDropDownModule,
    NzCheckboxModule,
    CoreModule
  ],
  templateUrl: './compare.component.html',
  styleUrl: './compare.component.less'
})
export class CompareComponent implements OnInit {
  private flagService = inject(FeatureFlagService);
  private projectService = inject(ProjectService);
  private message: NzMessageService = inject(NzMessageService);

  ngOnInit() {
    this.loadEnvs().then();
    this.loadTags();
    this.search$.pipe(debounceTime(250)).subscribe(() => this.loadOverview());
  }

  isLoadingOverview: boolean = false;
  overview: CompareFlagOverviews = {
    items: [],
    totalCount: 0
  }

  search$ = new Subject<void>();
  filter: IFeatureFlagListFilter = new IFeatureFlagListFilter();

  loadOverview() {
    this.isLoadingOverview = true;
    this.flagService.getCompareOverview(this.targetEnvs.map(env => env.value), this.filter)
    .pipe(finalize(() => this.isLoadingOverview = false))
    .subscribe({
      next: overview => this.overview = overview,
      error: () => this.message.error($localize`:@@common.loading-failed-try-again:Loading failed, please try again`),
    });
  }

  isLoadingTags: boolean = true;
  availableTags: SelectableTag[] = [];
  tagSearchText: string = '';
  loadTags() {
    this.isLoadingTags = true;
    this.flagService.getAllTags().subscribe(allTags => {
      this.availableTags = allTags.map(tagName => ({ name: tagName, selected: false }));
      this.isLoadingTags = false;
    });
  }

  isLoadingEnvs: boolean = true;
  envs: EnvironmentSelectOption[] = [];
  currentProjectEnv: IProjectEnv;
  async loadEnvs() {
    this.currentProjectEnv = getCurrentProjectEnv();

    this.isLoadingEnvs = true;
    const projects = await this.projectService.getListAsync();
    this.envs = projects.flatMap((project: IProject) =>
      project.environments.map((env: IEnvironment) => ({
        value: env.id,
        label: `${project.name}/${env.name}`
      }))
    )
    .filter(env => env.value !== this.currentProjectEnv.envId);

    this.isLoadingEnvs = false;
  }

  selectedEnvs: string[] = [];
  targetEnvs: EnvironmentSelectOption[] = [];
  hasUnappliedChanges: boolean = false;
  onSelectedEnvChanged() {
    if (this.targetEnvs.length === 0) {
      this.hasUnappliedChanges = false;
      return;
    }

    if (this.selectedEnvs.length === 0 || this.selectedEnvs.length != this.targetEnvs.length) {
      this.hasUnappliedChanges = true;
      return;
    }

    const targetEnvIds = new Set(this.targetEnvs.map(env => env.value));
    this.hasUnappliedChanges = this.selectedEnvs.some(envId => !targetEnvIds.has(envId));
  }
  apply() {
    this.targetEnvs = this.envs.filter(env => this.selectedEnvs.includes(env.value));
    this.loadOverview();
  }

  doSearch() {
    this.filter.pageIndex = 1;
    this.filter.tags = this.availableTags.filter(x => x.selected).map(x => x.name);
    this.search$.next();
  }

  get filteredTags(): SelectableTag[] {
    if (!this.tagSearchText) {
      return this.availableTags;
    }
    const searchLower = this.tagSearchText.toLowerCase();
    return this.availableTags.filter(tag =>
      tag.name.toLowerCase().includes(searchLower)
    );
  }

  getSelectedTagsLabel(): string {
    const selectedTags = this.availableTags.filter(tag => tag.selected);
    if (selectedTags.length === 0) {
      return 'any';
    }

    if (selectedTags.length === 1) {
      return selectedTags[0].name;
    }
    return `${selectedTags.length} selected`;
  }

  truncateText(text: string, maxLength: number = 80): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength) + '...';
  }

  getEnvDiffs(item: CompareFlagOverview, targetEnvId: string): { label: string, hasDiff: boolean }[] | undefined {
    const diff = item.diffs.find(x => x.targetEnvId === targetEnvId);
    if (!diff) {
      return undefined;
    }

    return [
      { label: $localize`:@@ff.compare.on-off-state:On/OFF State`, hasDiff: diff.onOffState },
      { label: $localize`:@@ff.compare.individual-targeting:Individual Targeting`, hasDiff: diff.individualTargeting },
      { label: $localize`:@@ff.compare.targeting-rules:Targeting Rules`, hasDiff: diff.targetingRule },
      { label: $localize`:@@ff.compare.default-rule:Default Rule`, hasDiff: diff.defaultRule },
      { label: $localize`:@@ff.compare.off-variation:Off Variation`, hasDiff: diff.offVariation }
    ];
  }

  hasDifferences(item: CompareFlagOverview, targetEnvId: string): boolean {
    const diffs = this.getEnvDiffs(item, targetEnvId);
    return diffs.some(diff => diff.hasDiff);
  }

  diffCountLabel(flag: CompareFlagOverview, envId: string): string {
    const diffs = this.getEnvDiffs(flag, envId);
    let count = diffs.filter(diff => diff.hasDiff).length;

    return count == 1 ?
      `1 ` + $localize`:common.difference:difference` :
      `${count} ` + $localize`:common.differences:differences`;
  }

  onSelectTags(visible: boolean) {
    if (visible === false) {
      this.doSearch();
    }
  }

  compareVisible: boolean = false;
  compare(item: CompareFlagOverview, targetEnvId: string) {
    this.compareVisible = true;
  }

  closeCompareDrawer() {
    this.compareVisible = false;
  }

  copyVisible: boolean = false;
  flagsToCopy: { id: string, name: string }[] = [];
  targetEnvIdForCopy: string = '';
  copy(flag: CompareFlagOverview, targetEnvId: string) {
    this.flagsToCopy = [{ id: flag.id, name: flag.name }];
    this.targetEnvIdForCopy = targetEnvId;
    this.copyVisible = true;
  }
  onCopyModalClose() {
    this.flagsToCopy = [];
    this.copyVisible = false;
    this.targetEnvIdForCopy = '';
  }
}
