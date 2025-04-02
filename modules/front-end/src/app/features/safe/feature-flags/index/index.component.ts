import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { encodeURIComponentFfc, getQueryParamsFromObject } from '@shared/utils';
import {
  FeatureFlagListCheckItem,
  IFeatureFlagListFilter,
  IFeatureFlagListItem,
  IFeatureFlagListModel,
} from "../types/feature-flag";
import { debounceTime } from 'rxjs/operators';
import { FeatureFlagService } from "@services/feature-flag.service";
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
    private modal: NzModalService,
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

  copyVisible: boolean = false;
  copyItems: FeatureFlagListCheckItem[] = [];
  batchCopy() {
    if (this.checkedItemKeys.size === 0) {
      this.msg.warning($localize `:@@ff.idx.select-ff-to-copy:Please select at least one feature flag to copy`);
      return;
    }

    this.copyItems = [];
    for (const key of this.checkedItemKeys) {
      const { id, name } = this.parseItemKey(key);
      this.copyItems.push({ id, name, checked: true });
    }

    this.copyVisible = true;
  }
  copy(flag: IFeatureFlagListItem) {
    this.copyItems = [ { id: flag.id, name: flag.name, checked: true } ];
    this.copyVisible = true;
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
  creationDrawerVisible: boolean = false;

  closeCreationDrawer() {
    this.creationDrawerVisible = false;
  }

  //#endregion
  onToggleFeatureFlagStatus(data: IFeatureFlagListItem): void {
    let msg: string = data.isEnabled
      ? $localize`:@@ff.idx.flag-turned-off:The status of feature flag <b>${data.name}</b> is changed to OFF`
      : $localize`:@@ff.idx.flag-turned-on:The status of feature flag <b>${data.name}</b> is changed to ON`;

    this.featureFlagService.toggleStatus(data.key).subscribe({
      next: _ => {
        this.msg.success(msg);
        data.isEnabled = !data.isEnabled;
      },
      error: _ => this.msg.error($localize`:@@ff.idx.status-change-failed:Failed to change feature flag status`)
    });
  }

  navigateToFlagDetail(key: string) {
    this.router.navigateByUrl(`/feature-flags/${encodeURIComponentFfc(key)}/targeting`).then();
  }

  archive(flag: IFeatureFlagListItem) {
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

  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.msg.success($localize `:@@common.copy-success:Copied`)
    );
  }

  getVaritonsWithTitles(variations: string[]) {
    return variations.map((v: string, index: number) => (`Variation ${index + 1}: ${v}`)).join(', ')
  }
}
