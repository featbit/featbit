import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IAuthProps } from "@shared/types";
import { getAuth } from "@utils/index";
import { IMember, memberRn } from "@features/safe/iam/types/member";
import { MemberService } from "@services/member.service";

@Component({
  selector: 'user-setting',
  templateUrl: './setting.component.html',
  styleUrls: ['./setting.component.less']
})
export class SettingComponent implements OnInit {

  get auth(): IAuthProps {
    return getAuth();
  }

  constructor(
    private route: ActivatedRoute,
    private message: NzMessageService,
    private memberService: MemberService,
    private router: Router
  ) { }

  isLoading: boolean = true;
  member: IMember;
  isEditingTitle: boolean = false;

  ngOnInit(): void {
    this.isLoading = true;

    this.route.paramMap.subscribe( paramMap => {
      const id = decodeURIComponent(paramMap.get('id'));
      this.memberService.get(id).subscribe(member => {
        this.member = {...member, resourceName: memberRn(member) };
        this.isLoading = false;
      })
    })
  }

  canDelete(): boolean {
    return this.auth.email !== this.member.email || this.auth.phoneNumber !== this.member.phoneNumber;
  }

  deleteMember() {
    this.memberService.delete(this.member.id).subscribe(() => {
      this.message.success(`刪除成功`);
      this.router.navigateByUrl(`/iam/users`);
    }, () => this.message.error('操作失败'))
  }

  updateMember() {
    this.memberService.update(this.member.id, {
      name: this.member.name
    }).subscribe(() => {
      this.message.success(`更新成功`);
    }, () => this.message.error('操作失败'))
  }

  copyText(text: string) {
    navigator.clipboard.writeText(text).then(
      () => this.message.success('复制成功')
    );
  }

  toggleTitleEditState(): void {
    this.isEditingTitle = !this.isEditingTitle;
  }

  onSaveSwitch(cb?: Function) {
    this.isEditingTitle = !this.isEditingTitle;
    this.updateMember();
  }
}
