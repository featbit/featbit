import { Component, OnInit } from '@angular/core';
import { GlobalUser, GlobalUserFilter } from "@features/safe/workspaces/types/global-user";
import { GlobalUserService } from "@services/global-user.service";
import { debounceTime } from "rxjs/operators";
import { Subject } from "rxjs";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'global-user',
  templateUrl: './global-user.component.html',
  styleUrls: ['./global-user.component.less']
})
export class GlobalUserComponent implements OnInit {


  isLoading: boolean = true;
  users: GlobalUser[] = [];
  totalCount = 0;

  filter: GlobalUserFilter = new GlobalUserFilter();
  search$ = new Subject<void>();

  extraShowedColumns: string[] = [];
  allExtraColumns: string[] = [];

  constructor(private service: GlobalUserService, private msg: NzMessageService) {
  }

  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(200)
    ).subscribe(() => {
      this.loadData();
    });
    this.search$.next();
  }

  private loadData() {
    this.isLoading = true;

    this.service.getList(this.filter).subscribe({
      next: (result) => {
        this.users = result.items;
        this.totalCount = result.totalCount;

        result.items.forEach(item => {
          item.customizedProperties.forEach(cp => {
            if (this.allExtraColumns.indexOf(cp.name) === -1) {
              this.allExtraColumns.push(cp.name);
            }
          });
        });

        this.isLoading = false;
      },
      error: () => {
        this.msg.error($localize`:@@common.failed-to-load-data:Failed to load data`);
        this.isLoading = false;
      }
    });
  }

  onSearch(resetPage: boolean = false) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next();
  }

  importModalVisible = false;
  openImportModal() {
    this.importModalVisible = true;
  }
  closeImportModal(success: boolean) {
    this.importModalVisible = false;
    if (success) {
      this.search$.next();
    }
  }

  selectedUser: GlobalUser;
  evaluationDrawerVisible = false;
  openEvaluationDrawer(user: GlobalUser) {
    this.selectedUser = user;
    this.evaluationDrawerVisible = true;
  }
  closeEvaluationDrawer() {
    this.selectedUser = null;
    this.evaluationDrawerVisible = false;
  }

  endUserDrawerVisible = false;
  openEndUserDrawer(user: GlobalUser) {
    this.selectedUser = user;
    this.endUserDrawerVisible = true;
  }
  closeEndUserDrawer() {
    this.selectedUser = null;
    this.endUserDrawerVisible = false;
  }

  getCustomizePropertyValue(user: GlobalUser, property: string): string {
    for (const customizedProperty of user.customizedProperties) {
      if (customizedProperty.name === property) {
        return customizedProperty.value;
      }
    }

    return '';
  }
}
