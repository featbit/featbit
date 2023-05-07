import { Component, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { copyToClipboard } from "@utils/index";
import { environment } from 'src/environments/environment';
import { IEnvironment, IProjectEnv, ISecret, SecretTypeEnum } from '@shared/types';
import { OrganizationService } from '@core/services/organization.service';
import { EnvService } from '@core/services/env.service';

@Component({
  selector: 'recap',
  templateUrl: './recap.component.html',
  styleUrls: ['./recap.component.less']
})
export class RecapComponent implements OnInit {

  secretTypeClient = SecretTypeEnum.Client;
  secretTypeServer = SecretTypeEnum.Server;
  
  env: IEnvironment;
  sdkEnpoint: string;
  apiHost: string;
  envSecret: string = 'xpF9nCGqNkuoHBL3xO5iHQ4RiDhL9qLUWT6KdK2mSegQ';
  constructor(
    private message: NzMessageService,
    private accountService: OrganizationService,
    private envService: EnvService,
  ) {
    this.sdkEnpoint = environment.evaluationUrl;
    this.apiHost = environment.url;

    const currentAccountProjectEnv = this.accountService.getCurrentOrganizationProjectEnv();
    this.envService.getEnv(currentAccountProjectEnv.projectEnv.projectId, currentAccountProjectEnv.projectEnv.envId).subscribe({
      next: (env) => {
        this.env = env;
      },
      error: () => {
        this.message.error($localize `:@@common.error-occurred-try-again:Error occurred, please try again`);
      }
    });
  }

  ngOnInit(): void {
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
