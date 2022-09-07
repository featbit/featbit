import { Component, OnInit } from '@angular/core';
import { encodeURIComponentFfc, getAuth } from '@utils/index';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { MemberService } from "@services/member.service";
import {IMember, IPagedMember, MemberFilter, memberRn} from "@features/safe/iam/types/member";
import {IAuthProps} from "@shared/types";

@Component({
  selector: 'iam-users',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit {
  get auth(): IAuthProps {
    return getAuth();
  }

  constructor(
    private router: Router,
    private message: NzMessageService,
    private memberService: MemberService
  ) { }

  private search$ = new Subject();
  ngOnInit(): void {
    this.search$.pipe(
      debounceTime(300)
    ).subscribe(() => {
      this.getUsers();
    });

    this.search$.next(null);
  }

  navigateToDetail(id: string) {
    this.router.navigateByUrl(`/iam/users/${encodeURIComponentFfc(id)}/groups`);
  }

  isLoading: boolean = true;
  pagedMember: IPagedMember = {
    items: [],
    totalCount: 0
  };

  filter: MemberFilter = new MemberFilter();

  doSearch(resetPage?: boolean) {
    if (resetPage) {
      this.filter.pageIndex = 1;
    }

    this.search$.next(null);
  }

  getUsers() {
    this.isLoading = true;
    this.memberService.getList(this.filter).subscribe(pagedMembers => {
      this.pagedMember = pagedMembers;
      this.isLoading = false;
    });
  }

  canDelete(member: IMember): boolean {
    return this.auth.email !== member.email || this.auth.phoneNumber !== member.phoneNumber;
  }

  deleteMember(member: IMember) {
    this.memberService.delete(member.id).subscribe(() => {
      this.message.success(`刪除成功`);
      this.pagedMember.items = this.pagedMember.items.filter(it => it.id !== member.id);
      this.pagedMember.totalCount--;
    }, () => this.message.error('操作失败'))
  }

  memberDrawerVisible: boolean = false;
  openMemberDrawer() {
    this.memberDrawerVisible = true;
  }
  memberDrawerClosed(added: any) {
    this.memberDrawerVisible = false;

    if (added) {
      this.getUsers();
    }
  }

  copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => this.message.success('复制成功')
    );
  }

  resourceName(member: IMember) {
    return memberRn(member);
  }
}
