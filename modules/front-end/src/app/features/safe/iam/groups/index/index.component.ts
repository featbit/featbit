import { Component, OnInit } from '@angular/core';
import { encodeURIComponentFfc, copyToClipboard } from '@utils/index';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { GroupService } from "@services/group.service";
import { GroupListFilter, groupRn, IGroup, IPagedGroup } from "@features/safe/iam/types/group";

@Component({
  selector: 'iam-users',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {

  constructor(
    private router: Router,
    private message: NzMessageService,
    private groupService: GroupService
  ) { }

  navigateToDetail(id: string) {
    this.router.navigateByUrl(`/iam/groups/${encodeURIComponentFfc(id)}/team`);
  }

  private search$ = new Subject();
  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getGroups();
    });

    this.search$.next(null);
  }

  groupDrawerVisible: boolean = false;
  openGroupDrawer(){
    this.groupDrawerVisible = true;
  }
  closeGroupDrawer(created: boolean) {
    this.groupDrawerVisible = false;
    if (created) {
      this.getGroups();
    }
  }

  isLoading: boolean = true;
  pagedGroup: IPagedGroup = {
    totalCount: 0,
    items: []
  };
  filter: GroupListFilter = new GroupListFilter();

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  getGroups() {
    this.isLoading = true;
    this.groupService.getList(this.filter).subscribe(pagedGroup => {
      this.pagedGroup = pagedGroup;
      this.isLoading = false;
    });
  }

  resourceName(group: IGroup) {
    return groupRn(group);
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }

  delete(group: IGroup) {
    this.groupService.delete(group.id).subscribe(() => {
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      this.pagedGroup.items = this.pagedGroup.items.filter(it => it.id !== group.id);
      this.pagedGroup.totalCount--;
    }, () => this.message.error($localize `:@@common.operation-failed:Operation failed`))
  }
}
