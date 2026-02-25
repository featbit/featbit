import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { GroupService } from "@services/group.service";
import { groupRn, IGroup } from "@features/safe/iam/types/group";
import { copyToClipboard } from '@utils/index';

@Component({
    selector: 'user-setting',
    templateUrl: './setting.component.html',
    styleUrls: ['./setting.component.less'],
    standalone: false
})
export class SettingComponent implements OnInit {

  constructor(
    private route: ActivatedRoute,
    private message: NzMessageService,
    private groupService: GroupService,
    private router: Router
  ) { }

  group: IGroup;
  isLoading = true;

  ngOnInit(): void {
    this.isLoading = true;

    this.route.paramMap.subscribe( paramMap => {
      const id = decodeURIComponent(paramMap.get('id'));
      this.groupService.get(id).subscribe(group => {
        this.isLoading = false;
        this.group = group;
      })
    });
  }

  save() {
    this.groupService.update(this.group).subscribe(updated => {
      this.group = updated;
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    }, err => this.message.error(err.error));
  }

  saveTitle() {
    this.toggleTitleEditState();
    this.save();
  }

  saveDescription() {
    this.toggleDescriptionEditState();
    this.save();
  }

  isEditingTitle = false;
  isEditingDescription = false;

  toggleTitleEditState(): void {
    this.isEditingTitle = !this.isEditingTitle;
  }

  toggleDescriptionEditState(): void {
    this.isEditingDescription = !this.isEditingDescription;
  }

  deleteGroup() {
    this.groupService.delete(this.group.id).subscribe(() => {
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      this.router.navigateByUrl(`/iam/groups`);
    }, () => this.message.error($localize `:@@common.operation-failed:Operation failed`))
  }

  resourceName() {
    return groupRn(this.group);
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
