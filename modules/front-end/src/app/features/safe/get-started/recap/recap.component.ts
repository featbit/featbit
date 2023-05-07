import { Component, EventEmitter, OnInit, Output } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { copyToClipboard } from "@utils/index";
import { environment } from 'src/environments/environment';
import { IEnvironment, ISecret, SecretTypeEnum } from '@shared/types';
import { OrganizationService } from '@core/services/organization.service';
import { EnvService } from '@core/services/env.service';

@Component({
  selector: 'recap',
  templateUrl: './recap.component.html',
  styleUrls: ['./recap.component.less']
})
export class RecapComponent implements OnInit {

  @Output() secretChange: EventEmitter<ISecret> = new EventEmitter();

  secretTypeClient = SecretTypeEnum.Client;
  secretTypeServer = SecretTypeEnum.Server;

  env: IEnvironment;
  sdkEnpoint: string;
  apiHost: string;
  selectedSecret: ISecret;

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
        this.selectedSecret = env.secrets[0];
      },
      error: () => {
        this.message.error($localize `:@@common.error-occurred-try-again:Error occurred, please try again`);
      }
    });
  }

  compareWith: (obj1: any, obj2: any) => boolean = (obj1: any, obj2: any) => {
    if (obj1 && obj2) {
      return obj1.id === obj2.id;
    } else {
      return false;
    }
  };

  ngOnInit(): void {
  }

  onSecretChange(secret: ISecret) {
    this.secretChange.emit(secret);
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }
}
