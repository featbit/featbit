import { Component, EventEmitter, Input, Output } from '@angular/core';
import { copyToClipboard } from "@utils/index";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'relay-proxy-key-modal',
  templateUrl: './relay-proxy-key-modal.component.html',
  styleUrls: [ './relay-proxy-key-modal.component.less' ]
})
export class RelayProxyKeyModalComponent {
  @Input()
  visible: boolean;
  @Input()
  key: string;
  @Output()
  onClose: EventEmitter<void> = new EventEmitter();

  copied: boolean = false;

  constructor(private message: NzMessageService) {
  }

  copyKey() {
    copyToClipboard(this.key).then(
      () => {
        this.message.success($localize`:@@common.copy-success:Copied`);
        this.copied = true;
      }
    );
  }

  close() {
    this.key = '';
    this.copied = false;

    this.onClose.emit();
  }
}
