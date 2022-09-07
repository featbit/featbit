import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import { encodeURIComponentFfc } from "@utils/index";
import { GroupService } from "@services/group.service";
import { GroupMemberFilter, IPagedGroupMember } from "@features/iam/types/group";

@Component({
  selector: 'users',
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.less']
})
export class UsersComponent implements OnInit {

  groupId: string = null;
  private search$ = new Subject();
  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private groupService: GroupService,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(paramMap => {
      this.groupId = decodeURIComponent(paramMap.get('id'));
    })

    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getMembers();
    });

    this.search$.next(null);
  }

  isLoading: boolean = true;
  members: IPagedGroupMember = {
    totalCount: 0,
    items: []
  };
  filter: GroupMemberFilter = new GroupMemberFilter();

  getMembers() {
    this.isLoading = true;
    this.groupService.getMembers(this.groupId, this.filter).subscribe(members => {
      this.members = members;
      this.isLoading = false;
    });
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  addMember(userId: string) {
    this.groupService.addMember(this.groupId, userId).subscribe(() => {
      this.members.items = this.members.items.map(item => {
        if (item.id === userId) {
          item.isGroupMember = true;
        }

        return item;
      });

      this.message.success('添加成功');
    }, () => this.message.error('添加失败'));
  }

  removeMember(userId: string) {
    this.groupService.removeMember(this.groupId, userId).subscribe(() => {
      this.members.items = this.members.items.map(item => {
        if (item.id === userId) {
          item.isGroupMember = false;
        }

        return item;
      });

      this.message.success('移除成功');
    }, () => this.message.error('移除失败'));
  }

  navigateToUserDetail(userId: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/iam/users/${encodeURIComponentFfc(userId)}/groups`])
    );

    window.open(url, '_blank');
  }
}
