import { Component, OnInit } from '@angular/core';
import { SelectableOptions } from '@core/components/table/dashed-multi-select/dashed-multi-select.component';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { EnvUserPropService } from "@services/env-user-prop.service";
import { IUserProp, IUserType, PageCursor } from "@shared/types";
import { EnvUserFilter } from "@features/safe/end-users/types/featureflag-user";
import { CURRENT_USER_FILTER_ATTRIBUTE } from "@utils/localstorage-keys";
import { EnvUserService } from "@services/env-user.service";
import { getCurrentProjectEnv } from "@utils/project-env";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
    selector: 'app-user-index',
    templateUrl: './index.component.html',
    styleUrls: ['./index.component.less'],
    standalone: false
})
export class IndexComponent implements OnInit {
  $search: Subject<void> = new Subject();

  currentEnvId: string;

  // cursor based pagination
  nextCursor?: PageCursor = undefined;
  previousCursor?: PageCursor = undefined;
  lastClickedPage: 'previous' | 'next' | null = null;

  goPreviousPage() {
    this.lastClickedPage = 'previous';

    if (this.isLoading || !this.previousCursor) {
      return;
    }

    this.fetchUserList(this.previousCursor);
  }

  goNextPage() {
    this.lastClickedPage = 'next';

    if (this.isLoading || !this.nextCursor) {
      return;
    }

    this.fetchUserList(this.nextCursor);
  }

  list = [];
  isLoading: boolean = true;

  filter: EnvUserFilter = new EnvUserFilter('', undefined, 10);
  pageSizeOptions = [
    { label: '10 / page', value: 10 },
    { label: '20 / page', value: 20 },
    { label: '30 / page', value: 30 }
  ];

  constructor(
    private envUserService: EnvUserService,
    private envUserPropService: EnvUserPropService,
    private message: NzMessageService
  ) { }

  getCustomizePropertyValue(user: IUserType, propName: string): string {
    const presetValueConfig = this.props.find(p => p.name === propName)?.presetValues || [];
    const property = user.customizedProperties?.find(cp => cp.name === propName);
    if (property) {
      const displayValue = presetValueConfig.find(c => c.value === property.value)?.description;
      return displayValue ? `${displayValue}(${property.value})` : property.value;
    }

    return '';
  }

  storeSelectedExtraColumns() {
    const config = {
      attributes: this.selectedExtraColumns
    };

    localStorage.setItem(CURRENT_USER_FILTER_ATTRIBUTE(this.currentEnvId), JSON.stringify(config));
  }

  props: IUserProp[];
  selectedExtraColumns: string[];
  extraColumnOptions: SelectableOptions[] = [];

  isUserPropsLoading: boolean = true;
  ngOnInit(): void {
    this.currentEnvId = getCurrentProjectEnv().envId;

    const filterAndAttributeConfig: any = JSON.parse(localStorage.getItem(CURRENT_USER_FILTER_ATTRIBUTE(this.currentEnvId)) || '{}');
    this.selectedExtraColumns = filterAndAttributeConfig?.attributes || [];

    this.envUserPropService.get().subscribe(props => {
      this.props = [...props];
      this.extraColumnOptions = this.props.filter(p => !p.isBuiltIn).map(col => ({
        label: col.name,
        value: col.name,
        selected: this.selectedExtraColumns.includes(col.name)
      }));
      this.isUserPropsLoading = false;
    });

    this.$search.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.fetchUserList();
    });

    this.$search.next();
  }

  onExtraColumnsChange(columns: string[]) {
    this.selectedExtraColumns = columns;
    this.extraColumnOptions.forEach(opt => opt.selected = columns.includes(opt.value));
    this.storeSelectedExtraColumns();
  }

  onSearch() {
    this.resetCursorPagination();
    this.$search.next();
  }

  onPageSizeChange(size: number) {
    this.filter.pageSize = size;
    this.resetCursorPagination();
    this.$search.next();
  }

  resetCursorPagination() {
    this.nextCursor = undefined;
    this.previousCursor = undefined;
    this.lastClickedPage = null;
  }

  fetchUserList(cursor?: PageCursor) {
    this.isLoading = true;

    const request = {
      ...this.filter,
      cursor
    };

    this.envUserService.getList(request).subscribe({
      next: pagedResult => {
        this.list = pagedResult.items;
        this.nextCursor = pagedResult.nextCursor;
        this.previousCursor = pagedResult.previousCursor;
        this.isLoading = false;
      },
      error: () => {
        this.message.error($localize`:@@common.failed-to-load-data:Failed to load data`);
        this.isLoading = false;
      }
    });
  }

  uploadModalVisible: boolean = false;
  uploadUrl = this.envUserService.uploadUrl();
  closeUploadModal(success: boolean) {
    this.uploadModalVisible = false;
    if (success) {
      this.$search.next();
    }
  }

  propsDrawerVisible: boolean = false;
  segmentsFlagsDrawerVisible: boolean = false;
  currentUser: IUserType = null;
  openSegmentsFlagsDrawer(user: IUserType) {
    this.currentUser = {...user};
    this.segmentsFlagsDrawerVisible = true;
  }

  closeSegmentsFlagsDrawer() {
    this.currentUser = null;
    this.segmentsFlagsDrawerVisible = false;
  }

  downloadConfirmVisible: boolean = false;
}
