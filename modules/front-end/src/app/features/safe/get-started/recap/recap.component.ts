import { Component, OnInit } from '@angular/core';
import { copyToClipboard } from "@utils/index";
import { ISecret, SecretTypeEnum } from "@shared/types";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'recap',
  templateUrl: './recap.component.html',
  styleUrls: ['./recap.component.less']
})
export class RecapComponent implements OnInit {

  secretTypeClient = SecretTypeEnum.Client;
  secretTypeServer = SecretTypeEnum.Server;

  secrets: ISecret[] = [];
  constructor(
    private messageService: NzMessageService,
  ) {
    this.secrets = [
      {
        id: 'aaa',
        name: 'api',
        type: SecretTypeEnum.Server,
        value: 'xxxxxxxx'
      },
      {
        id: 'bbb',
        name: 'bbbbbb',
        type: SecretTypeEnum.Client,
        value: 'yyyyyyyy'
      }
    ]

  }

  ngOnInit(): void {
  }

  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.messageService.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
