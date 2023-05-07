import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { IdentityService } from "@services/identity.service";
import { IAuthProps, ISecret } from "@shared/types";
import { getAuth } from "@utils/index";

@Component({
  selector: 'onboarding',
  templateUrl: './get-started.component.html',
  styleUrls: ['./get-started.component.less']
})
export class GetStartedComponent implements OnInit, OnDestroy {
  public auth: IAuthProps;
  private destroy$: Subject<void> = new Subject();

  secret: ISecret;

  constructor() { }

  ngOnInit(): void {
    this.auth = getAuth();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSecretChange(secret: ISecret) {
    this.secret = secret;
  }
}
