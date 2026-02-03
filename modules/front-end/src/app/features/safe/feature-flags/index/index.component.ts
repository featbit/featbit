import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { getProfile, getQueryParamsFromObject } from '@shared/utils';
import {
  FeatureFlagListCheckItem,
  getFlagRN,
  IFeatureFlagListFilter,
  IFeatureFlagListItem,
  IFeatureFlagListModel,
} from "../types/feature-flag";
import { debounceTime } from 'rxjs/operators';
import { FeatureFlagService } from "@services/feature-flag.service";
import { NzModalService } from "ng-zorro-antd/modal";
import { copyToClipboard } from '@utils/index';
import { permissionActions } from "@shared/policy";
import { getCurrentEnvRN } from "@utils/project-env";
import { PermissionLicenseService } from "@services/permission-license.service";
import { PermissionsService } from "@services/permissions.service";

@Component({
    selector: 'index',
    templateUrl: './index.component.html',
    styleUrls: ['./index.component.less'],
    standalone: false
})
export class IndexComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    private featureFlagService: FeatureFlagService,
    private msg: NzMessageService,
    private modal: NzModalService,
    private permissionsService: PermissionsService,
    private permissionLicenseService: PermissionLicenseService,
  ) { }

  featureFlagFilter: IFeatureFlagListFilter = new IFeatureFlagListFilter();

  get isArchived() {
    const value: any = this.featureFlagFilter.isArchived;
    return value === 'true' || value === true;
  }

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
  }

  // tags
  allTags: string[] = [];
  isLoadingTags: boolean = true;

  // table selection
  allChecked: boolean = false;
  indeterminate: boolean = false;

  onAllChecked(checked: boolean): void {
    this.listOfCurrentPageData
      .forEach(item => this.updateCheckedSet(item, checked));

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

  itemChecked(item: IFeatureFlagListItem): boolean {
    return !!this.checkedFlags[item.id];
  }

  checkedFlags: Record<string, IFeatureFlagListItem> = {};
  updateCheckedSet(item: IFeatureFlagListItem, checked: boolean) {
    if (checked) {
      this.checkedFlags[item.id] = item;
    } else {
      delete this.checkedFlags[item.id];
    }
  }

  onItemChecked(item: IFeatureFlagListItem): void {
    const checked = this.itemChecked(item);

    this.updateCheckedSet(item, !checked);
    this.refreshCheckedStatus();
  }

  copyVisible: boolean = false;
  copyItems: FeatureFlagListCheckItem[] = [];
  batchCopy() {
    if (Object.keys(this.checkedFlags).length === 0) {
      this.msg.warning($localize `:@@ff.idx.select-ff-to-copy:Please select at least one feature flag to copy`);
      return;
    }

    this.copyItems = [];
    for (const flag of Object.values(this.checkedFlags)) {
      const rn = getFlagRN(flag.key, flag.tags);
      const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.CopyFlagTo);
      if (!isGranted) {
        this.msg.warning(this.permissionsService.flagActionDenyMessage($localize `:@@common.copy-lowercase:copy`, flag.name));
        return;
      }

      const { id, name } = flag;
      this.copyItems.push({ id, name, checked: true });
    }

    this.copyVisible = true;
  }

  copy(flag: IFeatureFlagListItem) {
    const rn = getFlagRN(flag.key, flag.tags);
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.CopyFlagTo);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.flagActionDenyMessage($localize `:@@common.copy-lowercase:copy`, flag.name));
      return;
    }

    this.copyItems = [ { id: flag.id, name: flag.name, checked: true } ];
    this.copyVisible = true;
  }

  cloneVisible: boolean = false;
  flagToClone: IFeatureFlagListItem;
  clone(flag: IFeatureFlagListItem) {
    const rn = getFlagRN(flag.key, flag.tags);
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.CloneFlag);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.flagActionDenyMessage($localize `:@@common.clone-lowercase:clone`, flag.name));
      return;
    }

    this.flagToClone = flag;
    this.cloneVisible = true;
  }
  cloneModalClosed(completed: boolean) {
    this.flagToClone = undefined;
    this.cloneVisible = false;
  }

  compareVisible: boolean = false;
  flagToCompare: IFeatureFlagListItem;
  compare(flag: IFeatureFlagListItem) {
    this.flagToCompare = flag;
    this.compareVisible = true;
  }

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

  creationDrawerVisible: boolean = false;

  openCreationDrawer(): void {
    const rnPrefix = getCurrentEnvRN();
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(`${rnPrefix}:flag/*`, permissionActions.CreateFlag);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }
    this.creationDrawerVisible = true;
  }

  closeCreationDrawer() {
    this.creationDrawerVisible = false;
  }

  onToggleFeatureFlagStatus(data: IFeatureFlagListItem): void {
    const rn = getFlagRN(data.key, data.tags);
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.ToggleFlag);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    data.isToggling = true;

    let msg: string = data.isEnabled
      ? $localize`:@@ff.idx.flag-turned-off:The status of feature flag <b>${data.name}</b> is changed to OFF`
      : $localize`:@@ff.idx.flag-turned-on:The status of feature flag <b>${data.name}</b> is changed to ON`;

    this.featureFlagService.toggleStatus(data.key, !data.isEnabled).subscribe({
      next: _ => {
        this.msg.success(msg);
        data.isEnabled = !data.isEnabled;
        data.lastChange = {
          operator: getProfile(),
          happenedAt: new Date(),
          comment: ''
        };
        data.isToggling = false;
      },
      error: _ => {
        this.msg.error($localize`:@@ff.idx.status-change-failed:Failed to change feature flag status`);
        data.isToggling = false;
      }
    });
  }

  archive(flag: IFeatureFlagListItem) {
    const rn = getFlagRN(flag.key, flag.tags);
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.ArchiveFlag);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    let msg = $localize`:@@ff.archive-flag-warning:After archiving, the fallback value defined in your code will be returned for all your users. Be sure to remove code references to <strong>${flag.key}</strong> from your application before archiving.`;

    this.modal.confirm({
      nzContent: msg,
      nzTitle: $localize`:@@ff.are-you-sure-to-archive-ff:Are you sure to archive flag "${flag.name}"`,
      nzCentered: true,
      nzClassName: 'warning-modal-dialog',
      nzOkText: $localize`:@@common.archive:Archive`,
      nzWidth: '550px',
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

  restore(flag: IFeatureFlagListItem) {
    this.featureFlagService.restore(flag.key).subscribe({
      next: () => {
        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        this.onSearch();
      },
      error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }

  delete(flag: IFeatureFlagListItem) {
    this.featureFlagService.delete(flag.key).subscribe({
      next: () => {
        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        this.onSearch();
      },
      error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }

  getLocalDate(date: string | Date) {
    if (!date) return '';
    return new Date(date);
  }

  copyText(event: any, text: string) {
    copyToClipboard(text).then(
      () => this.msg.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
