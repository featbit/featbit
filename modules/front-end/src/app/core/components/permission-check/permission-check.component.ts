import { Component, Input, OnInit } from "@angular/core";
import { PermissionsService } from "@services/permissions.service";
import { IamPolicyAction } from "@shared/policy";

@Component({
  selector: 'permission-check',
  templateUrl: './permission-check.component.html',
  styleUrls: ['./permission-check.component.less']
})
export class PermissionCheckComponent implements OnInit {

  @Input() rn: string;
  @Input() action: IamPolicyAction;
  @Input() messageIfDeny: string = this.permissionsService.genericDenyMessage;

  canTakeAction: boolean = false;

  constructor(private permissionsService: PermissionsService) {
  }

  ngOnInit(): void {
    this.canTakeAction = this.permissionsService.isGranted(this.rn, this.action);
  }
}
