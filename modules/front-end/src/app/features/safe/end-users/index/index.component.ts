import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
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
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {
  $search: Subject<void> = new Subject();

  currentEnvId: string;

  list = [];
  totalCount: number;

  isLoading: boolean = true;
  attributeManagevisible: boolean = false;
  segmentsAndFlagsVisible: boolean = false;

  filter: EnvUserFilter = new EnvUserFilter();

  constructor(
    private envUserService: EnvUserService,
    private envUserPropService: EnvUserPropService,
    private router: Router
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
      attributes: this.extraColumns
    };

    localStorage.setItem(CURRENT_USER_FILTER_ATTRIBUTE(this.currentEnvId), JSON.stringify(config));
  }

  onSearchUserProperties(value: string = ''){
    const regex = new RegExp(value || '', 'ig');
    this.filteredProps = this.props.filter(p => regex.test(p.name)).map(p => p.name);
  }

  onSearchExtraColumns(value: string = ''){
    const regex = new RegExp(value || '', 'ig');
    this.filteredExtraColumns = this.props.filter(p => !p.isBuiltIn && regex.test(p.name)).map(p => p.name);
  }

  props: IUserProp[];
  filteredProps: string[];
  extraColumns: string[];
  filteredExtraColumns: string[];

  isUserPropsLoading: boolean = true;
  ngOnInit(): void {
    this.currentEnvId = getCurrentProjectEnv().envId;

    const filterAndAttributeConfig: any = JSON.parse(localStorage.getItem(CURRENT_USER_FILTER_ATTRIBUTE(this.currentEnvId)) || '{}');
    this.filter.properties = filterAndAttributeConfig?.properties || [];
    this.extraColumns = filterAndAttributeConfig?.attributes || [];

    this.envUserPropService.get().subscribe(props => {
      this.props = [...props];
      this.filteredProps = this.props.map(p => p.name);
      this.filteredExtraColumns = this.props.filter(p => !p.isBuiltIn).map(p => p.name);
      this.isUserPropsLoading = false;
    })

    this.$search.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.fetchUserList();
    });

    this.$search.next();
  }

  onRemoveFilterItem(prop: string) {
    this.filter.properties = this.filter.properties.filter(p => p !== prop);
  }

  onRemoveAttributeItem(prop: string) {
    this.extraColumns = this.extraColumns.filter(p => p !== prop);
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

  navigateToUserDetail(user: IUserType) {
    this.router.navigateByUrl(`/users/${encodeURIComponent(user.id)}`);
  }

  onPropsSettingClick() {
    this.attributeManagevisible = true;
  }

  onPropsSettingClose() {
    this.attributeManagevisible = false;
  }

  currentUser: IUserType = null;
  onSegmentsAndFlagsClick(user: IUserType) {
    this.currentUser = {...user};
    this.segmentsAndFlagsVisible = true;
  }

  onSegmentsAndFlagsClose() {
    this.currentUser = null;
    this.segmentsAndFlagsVisible = false;
  }
}
