import {Component, OnInit} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import {encodeURIComponentFfc, getPathPrefix} from "@utils/index";
import { MemberService } from "@services/member.service";
import { IPagedMemberGroup, MemberGroupFilter } from "@features/safe/iam/types/member";
import { GroupService } from "@services/group.service";

@Component({
    selector: 'groups',
    templateUrl: './groups.component.html',
    styleUrls: ['./groups.component.less'],
    standalone: false
})
export class GroupsComponent implements OnInit {

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private memberService: MemberService,
    private groupService: GroupService,
    private message: NzMessageService
  ) { }

  memberId: string = '';
  private search$ = new Subject();
  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
      this.memberId = decodeURIComponent(paramMap.get('id'));
    })

    this.search$.pipe(debounceTime(300)).subscribe(() => {
      this.getGroups();
    });

    this.search$.next(null);
  }

  goToGroup(groupId: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`${getPathPrefix()}iam/groups/${encodeURIComponentFfc(groupId)}/team`])
    );

    window.open(url, '_blank');
  }

  isLoading: boolean = true;
  groups: IPagedMemberGroup = {
    totalCount: 0,
    items: []
  };
  filter: MemberGroupFilter = new MemberGroupFilter();

  getGroups() {
    this.isLoading = true;
    this.memberService.getGroups(this.memberId, this.filter).subscribe(groups => {
      this.groups = groups;
      this.isLoading = false;
    });
  }

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  addToGroup(groupId: string) {
    this.groupService.addMember(groupId, this.memberId).subscribe(() => {
      this.groups.items = this.groups.items.map(item => {
        if (item.id === groupId) {
          item.isGroupMember = true;
        }

        return item;
      });

      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    }, () => this.message.error($localize `:@@common.operation-failed:Operation failed`));
  }

  removeFromGroup(groupId: string) {
    this.groupService.removeMember(groupId, this.memberId).subscribe(() => {
      this.groups.items = this.groups.items.map(item => {
        if (item.id === groupId) {
          item.isGroupMember = false;
        }

        return item;
      });

      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    }, () => this.message.error($localize `:@@common.operation-failed:Operation failed`));
  }
}
