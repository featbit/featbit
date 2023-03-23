import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { encodeURIComponentFfc, getQueryParamsFromObject, slugify } from '@shared/utils';
import {
  IFeatureFlagListCheckItem,
  IFeatureFlagListFilter,
  IFeatureFlagListItem,
  IFeatureFlagListModel,
} from "../types/switch-index";
import { debounceTime, first, map, switchMap } from 'rxjs/operators';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { getCurrentOrganization, getCurrentProjectEnv } from "@utils/project-env";
import { ProjectService } from "@services/project.service";
import { IEnvironment } from "@shared/types";
import { NzNotificationService } from "ng-zorro-antd/notification";
import { FeatureFlagService } from "@services/feature-flag.service";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { NzModalService } from "ng-zorro-antd/modal";
import { copyToClipboard } from '@utils/index';

@Component({
  selector: 'index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private router: Router,
    private featureFlagService: FeatureFlagService,
    private msg: NzMessageService,
    private fb: FormBuilder,
    private projectService: ProjectService,
    private notification: NzNotificationService,
    private modal: NzModalService,
  ) {
    this.featureFlagForm = this.fb.group({
      name: ['', Validators.required],
      key: ['', Validators.required, this.flagKeyAsyncValidator],
      description:['',Validators.maxLength(512)]
    });
  }

  featureFlagFilter: IFeatureFlagListFilter = new IFeatureFlagListFilter();

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      Object.keys(params).forEach((k) => {
        if (k === 'tags') {
          if (params[k].length > 0) {
            this.featureFlagFilter[k] = params[k].split(',');
          }
        } else {
          this.featureFlagFilter[k] = params[k];
        }
      });
    });

    let currentProjectEnv = getCurrentProjectEnv();

    this.featureFlagService.envId = currentProjectEnv.envId;

    // get switch list
    this.$search.pipe(
      debounceTime(200)
    ).subscribe(() => {
      this.loadFeatureFlagList();
    });
    this.$search.next();

    // get flag tags
    this.featureFlagService.getAllTags().subscribe(allTags => {
      this.allTags = allTags;
      this.isLoadingTags = false;
    });

    // get current envs
    const curAccountId = getCurrentOrganization().id;
    const curProjectId = currentProjectEnv.projectId;
    const curEnvId = currentProjectEnv.envId;

    this.projectService.get(curProjectId)
      .pipe(map(project => project.environments))
      .subscribe(envs => {
        this.envs = envs.filter(x => x.id !== curEnvId);
        this.targetEnv = this.envs[0];
      });
  }

  // tags
  allTags: string[] = [];
  isLoadingTags: boolean = true;

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

  loading: boolean = true;

  loadFeatureFlagList() {
    this.loading = true;
    this.featureFlagService
      .getList(this.featureFlagFilter)
      .subscribe((featureFlags: IFeatureFlagListModel) => {
        this.featureFlagListModel = featureFlags;
        this.loading = false;
      });
  }

  $search: Subject<void> = new Subject();

  onSearch(resetPage?: boolean) {
    // add filter to query params
    const params = getQueryParamsFromObject(this.featureFlagFilter);
    history.replaceState(null, '', `feature-flags?${params}`);
    this.cdr.detectChanges();

    this.loading = true;
    this.featureFlagListModel = {
      items: [],
      totalCount: 0
    };

    if (resetPage) {
      this.featureFlagFilter.pageIndex = 1;
    }
    this.$search.next();
  }

  //#endregion

  //#region create switch
  createModalVisible: boolean = false;
  featureFlagForm: FormGroup;

  flagKeyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.featureFlagService.isKeyUsed(value as string)),
    map(isKeyUsed => {
      switch (isKeyUsed) {
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

  nameChange(name: string) {
    let keyControl = this.featureFlagForm.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  create() {
    this.creating = true;

    this.featureFlagService.create(this.featureFlagForm.value).subscribe({
      next: (result: IFeatureFlag) => {
        this.navigateToFlagDetail(result);
        this.creating = false;
      },
      error: (err) => {
        this.msg.error(err.error);
        this.creating = false;
      }
    });
  }

  closeCreateModal() {
    this.createModalVisible = false;
    this.featureFlagForm.reset();
  }

  //#endregion
  onToggleFeatureFlagStatus(data: IFeatureFlagListItem): void {
    let msg: string;
    if (data.isEnabled) {
      msg = $localize `:@@ff.idx.the-status-of-ff:The status of feature flag ` +
        `<b>${data.name}</b>` + $localize `:@@ff.idx.changed-to-off:is changed to OFF`;
    } else {
      msg = $localize `:@@ff.idx.the-status-of-ff:The status of feature flag ` +
        `<b>${data.name}</b>` + $localize `:@@ff.idx.changed-to-on:is changed to ON`;
    }

    this.featureFlagService.toggleStatus(data.key)
      .subscribe(_ => {
        this.msg.success(msg);
        data.isEnabled = !data.isEnabled;
      }, _ => {
        this.msg.error($localize `:@@ff.idx.status-change-failed:Failed to change feature flag status`);
      });
  }

  public navigateToFlagDetail(data: IFeatureFlag) {
    this.featureFlagService.setCurrentFeatureFlag(data);
    this.router.navigateByUrl(`/feature-flags/${encodeURIComponentFfc(data.key)}/targeting`);
  }

  archive(flag: IFeatureFlag) {
    let msg = $localize`:@@ff.archive-flag-warning:Flag <strong>${flag.name}</strong> will be archived, and the value defined in your code will be returned for all your users. Remove code references to <strong>${flag.key}</strong> from your application before archiving.`;

    this.modal.confirm({
      nzContent: msg,
      nzTitle: $localize`:@@ff.are-you-sure-to-archive-ff:Are you sure to archive this feature flag?`,
      nzCentered: true,
      nzClassName: 'information-modal-dialog',
      nzOnOk: () => {
        this.featureFlagService.archive(flag.key).subscribe({
            next: () => {
              this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
              this.onSearch();
            },
            error: () => this.msg.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`)
          }
        );
      }
    });
  }

  restore(flag: IFeatureFlag) {
    this.featureFlagService.restore(flag.key).subscribe({
      next: () => {
        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        this.onSearch();
      },
      error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }

  delete(flag: IFeatureFlag) {
    this.featureFlagService.delete(flag.key).subscribe({
      next: () => {
        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        this.onSearch();
      },
      error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }

  getLocalDate(date: string) {
    if (!date) return '';
    return new Date(date);
  }

  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.msg.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
