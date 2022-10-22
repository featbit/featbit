import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { encodeURIComponentFfc } from '@shared/utils';
import { SwitchTagTreeService } from "@services/switch-tag-tree.service";
import {
  IFeatureFlagListCheckItem,
  IFeatureFlagListFilter,
  IFeatureFlagListItem,
  IFeatureFlagListModel,
  FeatureFlagTagTree
} from "../types/switch-index";
import { debounceTime, first, map, switchMap } from 'rxjs/operators';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { getCurrentOrganization, getCurrentProjectEnv } from "@utils/project-env";
import { ProjectService } from "@services/project.service";
import { IEnvironment } from "@shared/types";
import { NzNotificationService } from "ng-zorro-antd/notification";
import {FeatureFlagService} from "@services/feature-flag.service";
import {IFeatureFlag} from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {

  constructor(
    private router: Router,
    private featureFlagService: FeatureFlagService,
    private msg: NzMessageService,
    private switchTagTreeService: SwitchTagTreeService,
    private fb: FormBuilder,
    private projectService: ProjectService,
    private notification: NzNotificationService
  ) {
    this.featureFlagForm = this.fb.group({
      name: ['', [this.featureFlagNameValidator], [this.featureFlagNameAsyncValidator], 'change'],
      keyName: [{ value: '', disabled: true }, [Validators.required]]
    });

    this.compareAndCopyFlag = false;
  }

  ngOnInit(): void {
    let currentProjectEnv = getCurrentProjectEnv();

    this.featureFlagService.envId = currentProjectEnv.envId;

    // // get switch tag tree
    // this.switchTagTreeService.getTree()
    //   .subscribe(res => this.tagTree = res);

    // get switch list
    this.$search.pipe(
      debounceTime(200)
    ).subscribe(() => {
      this.loadFeatureFlagList();
    });
    this.$search.next();

    // get current envs
    const curAccountId = getCurrentOrganization().id;
    const curProjectId = currentProjectEnv.projectId;
    const curEnvId = currentProjectEnv.envId;

    this.projectService.getProject(curAccountId, curProjectId)
      .pipe(map(project => project.environments))
      .subscribe(envs => {
        this.envs = envs.filter(x => x.id !== curEnvId);
        this.targetEnv = this.envs[0];
      });
  }

  // tag tree
  tagTreeModalVisible: boolean = false;
  tagTree: FeatureFlagTagTree = new FeatureFlagTagTree([]);

  // table selection
  allChecked: boolean = false;
  indeterminate: boolean = false;

  onAllChecked(checked: boolean): void {
    this.listOfCurrentPageData
      .forEach(item => this.updateCheckedSet(this.getItemKey(item), checked));

    this.refreshCheckedStatus();
  }

  listOfCurrentPageData: IFeatureFlagListItem[] = [];
  onCurrentPageDataChange(data: IFeatureFlagListItem[]) {
    this.listOfCurrentPageData = data;
    this.refreshCheckedStatus();
  }

  refreshCheckedStatus(): void {
    let currentPageData = this.listOfCurrentPageData;

    this.allChecked = currentPageData.length > 0 && currentPageData.every(item => this.itemChecked(item));
    this.indeterminate = !this.allChecked && currentPageData.some(item => this.itemChecked(item));
  }

  getItemKey(item: IFeatureFlagListItem) {
    return `${item.id};${item.name};`;
  }

  parseItemKey(key: string): { id: string, name: string } {
    let [id, name] = key.split(';');
    return { id, name };
  }

  itemChecked(item: IFeatureFlagListItem): boolean {
    const key = this.getItemKey(item);

    return this.checkedItemKeys.has(key);
  }

  checkedItemKeys = new Set<string>();
  updateCheckedSet(key: string, checked: boolean) {
    if (checked) {
      this.checkedItemKeys.add(key);
    } else {
      this.checkedItemKeys.delete(key);
    }
  }

  onItemChecked(item: IFeatureFlagListItem): void {
    const key = this.getItemKey(item);
    const checked = this.checkedItemKeys.has(key);

    this.updateCheckedSet(key, !checked);
    this.refreshCheckedStatus();
  }

  // batch copy
  batchCopyVisible: boolean = false;
  checkedItems: IFeatureFlagListCheckItem[] = [];
  get totalSelected() {
    return this.checkedItems.filter(x => x.checked).length;
  }

  envs: IEnvironment[] = [];
  targetEnv: IEnvironment;
  selectTargetEnv(env: IEnvironment) {
    this.targetEnv = env;
  }
  openBatchCopyModal() {
    if (this.checkedItemKeys.size === 0) {
      this.msg.warning($localize `:@@ff.idx.select-ff-to-copy:Please select at least one feature flag to copy`);
      return;
    }

    this.checkedItems = [];
    for (const key of this.checkedItemKeys) {
      const { id, name } = this.parseItemKey(key);
      this.checkedItems.push({ id, name, checked: true });
    }

    this.batchCopyVisible = true;
  }

  isCopying: boolean = false;
  batchCopy() {
    this.isCopying = true;

    this.featureFlagService
      .copyToEnv(this.targetEnv.id, this.checkedItems.filter(x => x.checked).map(x => x.id))
      .subscribe(copyToEnvResult => {
        this.isCopying = false;
        this.batchCopyVisible = false;
        this.checkedItemKeys.clear();
        this.refreshCheckedStatus();

        let msg = $localize `:@@ff.idx.successfully-copied:Successfully copied`
          + `<strong> ${copyToEnvResult.copiedCount} </strong>`
          + $localize `:@@ff.idx.ff-to-env:feature flags to environment`
          + `<strong> ${this.targetEnv.name} </strong>.`;

        if (copyToEnvResult.ignored.length > 0) {
          msg += '<br/>' + $localize `:@@ff.idx.following-ff-exist-in-targeting-env:Following feature flags have been ignored as they are already in the targeting environment`
            + `<br/> ${copyToEnvResult.ignored.join(', ')}`;
          this.notification.warning($localize `:@@ff.idx.copy-result:Copy result`, msg, { nzDuration: 0 });
        } else {
          this.notification.success($localize `:@@common.copy-success:Copied`,msg);
        }
      }, _ => {
        this.isCopying = false;
      });
  }

  //#region switch list

  featureFlagListModel: IFeatureFlagListModel = {
    items: [],
    totalCount: 0
  };

  Loading: boolean = true;
  compareAndCopyFlag: boolean = true;

  loadFeatureFlagList() {
    this.Loading = true;
    this.featureFlagService
      .getList(this.featureFlagFilter)
      .subscribe((featureFlags: IFeatureFlagListModel) => {
        this.featureFlagListModel = featureFlags;
        this.Loading = false;
      });
  }

  featureFlagFilter: IFeatureFlagListFilter = new IFeatureFlagListFilter();

  onSelectTag(nodeIds: number[]) {
    this.featureFlagFilter.tagIds = nodeIds;

    this.onSearch();
  }

  $search: Subject<void> = new Subject();

  onSearch(resetPage?: boolean) {
    if (resetPage) {
      this.featureFlagFilter.pageIndex = 1;
    }
    this.$search.next();
  }

  //#endregion

  //#region create switch
  createModalVisible: boolean = false;
  featureFlagForm: FormGroup;

  featureFlagNameValidator = (control: FormControl) => {
    const name = control.value;
    if (!name) {
      return { error: true, required: true };
    }

    if (name.includes('__')) {
      return { error: true, invalid_character: true };
    }
  }

  featureFlagNameAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.featureFlagService.isKeyUsed(value as string)),
    map(isNameUsed => {
      switch (isNameUsed) {
        case true:
          return { error: true, duplicated: true };
        case undefined:
          return { error: true, unknown: true };
        default:
          return null;
      }
    }),
    first()
  );

  creating: boolean = false;

  createFeatureFlag() {
    this.creating = true;

    const name = this.featureFlagForm.get('name').value;

    this.featureFlagService.create(name)
      .subscribe((result: IFeatureFlag) => {
        this.featureFlagService.setCurrentFeatureFlag(result);
        this.toFeatureFlagDetail(result.key);
        this.creating = false;
      }, err => {
        this.msg.error(err.error);
        this.creating = false;
      });
  }

  closeCreateModal() {
    this.createModalVisible = false;
    this.featureFlagForm.reset();
  }

  //#endregion
  onToggleFeatureFlagStatus(data: IFeatureFlagListItem): void {
    // Toggle of status is disabled for archived feature flags
    if (this.featureFlagFilter.isArchived) {
      return;
    }

    let msg: string;
    if (data.isEnabled) {
      msg = $localize `:@@ff.idx.the-status-of-ff:The status of feature flag ` +
        data.name + $localize `:@@ff.idx.changed-to-off:is changed to OFF`;
    } else {
      msg = $localize `:@@ff.idx.the-status-of-ff:The status of feature flag ` +
        data.name + $localize `:@@ff.idx.changed-to-on:is changed to ON`;
    }

    this.featureFlagService.toggleStatus(data.id)
      .subscribe(_ => {
        this.msg.success(msg);
        data.isEnabled = !data.isEnabled;
      }, _ => {
        this.msg.error($localize `:@@ff.idx.status-change-failed:Failed to change feature flag status`);
      });
  }

  public onIntoFeatureFlagDetail(data: IFeatureFlag) {
    this.featureFlagService.setCurrentFeatureFlag(data);
    this.toFeatureFlagDetail(data.key);
  }

  public onIntoCompareAndCopy() {
    this.router.navigateByUrl('/compare-and-copy');
  }

  private toFeatureFlagDetail(key: string) {
    this.router.navigateByUrl(`/feature-flags/${encodeURIComponentFfc(key)}/targeting`);
  }

  getLocalDate(date: string) {
    if (!date) return '';
    return new Date(date);
  }

  copyText(event, text: string) {
    navigator.clipboard.writeText(text).then(
      () => this.msg.success($localize `:@@common.copy-success:Copied`)
    );
  }

  saveTagTree() {
    this.switchTagTreeService.saveTree(this.tagTree)
      .subscribe(savedTagTree => {
        // for trigger change detection
        this.tagTree = savedTagTree;

        // update switch tags when save tagTree
        for (const item of this.featureFlagListModel.items) {
          item.tags = this.tagTree.getFeatureFlagTags(item.id);
        }

        this.msg.success($localize `:@@common.operation-success:Operation succeeded`);
      }, err => {
        this.msg.error(err.error);
      });

    // close modal
    this.tagTreeModalVisible = false;
  }
}
