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

    this.service.getList().subscribe({
      next: (result) => {
        this.users = result.items;
        this.totalCount = result.totalCount;
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
      this.filter.pageIndex = 0;
    }

    this.search$.next();
  }

  importModalVisible = false;
  openImportModal() {
    this.importModalVisible = true;
  }
  closeImportModal() {
    this.importModalVisible = false;
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
}
