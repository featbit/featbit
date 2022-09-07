import { Component, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { IAuthProps } from '@shared/types';
import { AccountService } from '@services/account.service';
import { getAuth } from '@shared/utils';
import { MemberService } from "@services/member.service";
import { IMember, IPagedMember, MemberFilter } from "@features/iam/types/member";
import { NzMessageService } from "ng-zorro-antd/message";
import { debounceTime } from "rxjs/operators";

@Component({
  selector: 'app-team',
  templateUrl: './team.component.html',
  styleUrls: ['./team.component.less']
})
export class TeamComponent implements OnInit {

  constructor(
    private accountService: AccountService,
    private memberService: MemberService,
    private message: NzMessageService
  ) { }

  auth: IAuthProps;
  search$ = new Subject();
  ngOnInit(): void {
    this.auth = getAuth();

    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getMembers();
    });

    this.search$.next(null);
  }

  isLoading = true;
  filter: MemberFilter = new MemberFilter();
  members: IPagedMember = {
    totalCount: 0,
    items: []
  };

  getMembers() {
    this.isLoading = true;

    this.memberService.getList(this.filter).subscribe(members => {
      this.isLoading = false;
      this.members = members;
    })
  };

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  canDelete(member: IMember): boolean {
    return this.auth.email !== member.email || this.auth.phoneNumber !== member.phoneNumber;
  }

  deleteMember(member: IMember) {
    this.memberService.delete(member.id).subscribe(() => {
      this.message.success('移除成功');
      this.getMembers();
    });
  }

  memberDrawerVisible: boolean = false;
  showMemberDrawer(){
    this.memberDrawerVisible = true;
  }
  memberDrawerClosed(created: boolean) {
    this.memberDrawerVisible = false;

    if (created) {
      this.getMembers();
    }
  }
}
