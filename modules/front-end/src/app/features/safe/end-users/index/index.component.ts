import { Component, OnInit } from '@angular/core';
import { SelectableOptions } from '@core/components/table/dashed-multi-select/dashed-multi-select.component';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { EnvUserPropService } from "@services/env-user-prop.service";
import { IUserProp, IUserType } from "@shared/types";
import { EnvUserFilter } from "@features/safe/end-users/types/featureflag-user";
import { CURRENT_USER_FILTER_ATTRIBUTE } from "@utils/localstorage-keys";
import { EnvUserService } from "@services/env-user.service";
import { getCurrentProjectEnv } from "@utils/project-env";

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
  hasPreviousPage: boolean = false;
  hasNextPage: boolean = true;
  lastClickedPage: 'previous' | 'next' | null = null;

  goPreviousPage() {
    this.lastClickedPage = 'previous';
  }

  goNextPage() {
    this.lastClickedPage = 'next';
  }

  list = [];
  totalCount: number;

  isLoading: boolean = true;

  filter: EnvUserFilter = new EnvUserFilter();

  constructor(
    private envUserService: EnvUserService,
    private envUserPropService: EnvUserPropService
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

  storeFilterAndAttribute(triggerSearch: boolean = false) {
    if (triggerSearch) {
      this.$search.next();
    }

    const config = {
      properties: this.filter.properties,
      attributes: this.selectedExtraColumns
    };

    localStorage.setItem(CURRENT_USER_FILTER_ATTRIBUTE(this.currentEnvId), JSON.stringify(config));
  }

  onFilterPropertiesChange(properties: string[]) {
    this.filter.properties = properties;
    this.filterOptions.forEach(opt => opt.selected = properties.includes(opt.value));
    this.storeFilterAndAttribute(true);
  }

  props: IUserProp[];
  filterOptions: SelectableOptions[] = [];
  selectedExtraColumns: string[];
  extraColumnOptions: SelectableOptions[] = [];

  isUserPropsLoading: boolean = true;
  ngOnInit(): void {
    this.currentEnvId = getCurrentProjectEnv().envId;

    const filterAndAttributeConfig: any = JSON.parse(localStorage.getItem(CURRENT_USER_FILTER_ATTRIBUTE(this.currentEnvId)) || '{}');
    this.filter.properties = filterAndAttributeConfig?.properties || [];
    this.selectedExtraColumns = filterAndAttributeConfig?.attributes || [];

    this.envUserPropService.get().subscribe(props => {
      this.props = [...props];
      this.filterOptions = this.props.map(p => ({
        label: p.name,
        value: p.name,
        selected: this.filter.properties.includes(p.name)
      }));
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
    this.storeFilterAndAttribute();
  }

  onSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }
    this.$search.next();
  }

  fetchUserList() {
    this.isLoading = true;
    this.envUserService.search(this.filter).subscribe(
      pagedResult => {
        this.isLoading = false;
        this.list = pagedResult.items;
        this.totalCount = pagedResult.totalCount;
      },
      _ => {
        this.isLoading = false;
      }
    );
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
