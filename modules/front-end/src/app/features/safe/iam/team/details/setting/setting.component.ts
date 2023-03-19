import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IAuthProps } from "@shared/types";
import { getAuth, copyToClipboard } from "@utils/index";
import { IMember, memberRn } from "@features/safe/iam/types/member";
import { MemberService } from "@services/member.service";
import {UserService} from "@services/user.service";

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
    private userService: UserService,
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
    return this.auth.email !== this.member.email;
  }

  deleteMember() {
    this.memberService.delete(this.member.id).subscribe(() => {
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      this.router.navigateByUrl(`/iam/users`);
    }, () => this.message.error($localize `:@@common.operation-failed:Operation failed`))
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }

  toggleTitleEditState(): void {
    this.isEditingTitle = !this.isEditingTitle;
  }
}
