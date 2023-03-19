import { Component, OnInit } from '@angular/core';
import { copyToClipboard, encodeURIComponentFfc, getAuth } from '@utils/index';
import { Subject } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { MemberService } from "@services/member.service";
import {IMember, IMemberListModel, MemberFilter, memberRn} from "@features/safe/iam/types/member";
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
    this.router.navigateByUrl(`/iam/team/${encodeURIComponentFfc(id)}/groups`);
  }

  isLoading: boolean = true;
  pagedMember: IMemberListModel = {
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
    return this.auth.email !== member.email;
  }

  deleteMember(member: IMember) {
    this.memberService.delete(member.id).subscribe(() => {
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      this.pagedMember.items = this.pagedMember.items.filter(it => it.id !== member.id);
      this.pagedMember.totalCount--;
    }, () => this.message.error($localize `:@@common.operation-failed:Operation failed`))
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
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }

  resourceName(member: IMember) {
    return memberRn(member);
  }
}
