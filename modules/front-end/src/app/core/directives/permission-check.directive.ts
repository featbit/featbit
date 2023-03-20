import { Directive, EventEmitter, HostListener, Input, Output } from "@angular/core";
import { NzMessageService } from "ng-zorro-antd/message";
import { PermissionsService } from "@services/permissions.service";
import { IamPolicyAction } from "@shared/policy";

@Directive({
  selector: '[permission-check]'
})
export class PermissionCheckDirective {

  @Input() rn: string;
  @Input() action: IamPolicyAction;
  @Input() messageIfDeny: string = this.permissionsService.genericDenyMessage;

  @Output() actionIfAllow = new EventEmitter();

  constructor(
    private permissionsService: PermissionsService,
    private message: NzMessageService) {
  }

  @HostListener('click') onClick() {
    const canTakeAction = this.permissionsService.isGranted(this.rn, this.action);
    if (!canTakeAction) {
      this.message.warning(this.messageIfDeny);
    } else {
      this.actionIfAllow.emit();
    }
  }
}
