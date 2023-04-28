import { Component, Input, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { copyToClipboard } from "@utils/index";

@Component({
  selector: 'recap',
  templateUrl: './recap.component.html',
  styleUrls: ['./recap.component.less']
})
export class RecapComponent implements OnInit {
  constructor(
    private message: NzMessageService) {
  }

  ngOnInit(): void {
  }

  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
