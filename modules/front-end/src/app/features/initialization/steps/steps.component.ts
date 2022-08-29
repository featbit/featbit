import { Component, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AccountService } from 'src/app/services/account.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { encodeURIComponentFfc } from 'src/app/utils';


@Component({
  selector: 'init-steps',
  templateUrl: './steps.component.html',
  styleUrls: ['./steps.component.less']
})
export class StepsComponent implements OnDestroy {

  private destory$: Subject<void> = new Subject();
  currentStep = 0;
  currentAccountId: number;
  step0Form: FormGroup;
  step1Form: FormGroup;

  constructor(
    private router: Router,
    private accountService: AccountService,
    private msg: NzMessageService,
    private fb: FormBuilder
  ) {

    this.step0Form = this.fb.group({
      organizationName: ['', [Validators.required]],
      projectName: ['', [Validators.required]]
    });

    this.step1Form = this.fb.group({
      flagName: ['', [Validators.required]],
      flagKey: [{value: '', disabled: true}, [Validators.required]],
    });

    this.accountService.getCurrentAccount().subscribe(() => {
      const { account } = this.accountService.getCurrentAccountProjectEnv();
      this.currentAccountId = account.id;
      this.step0Form.patchValue({
        organizationName: account.organizationName
      });
    });
  }

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }

  pre(): void {
    this.currentStep -= 1;
  }

  next(): void {
    this.currentStep += 1;
  }

  done(): void {
    const { organizationName, projectName } = this.step0Form.value;
    const { flagName } = this.step1Form.value;

    this.accountService.initialize(this.currentAccountId, {organizationName, projectName, flagName, envName: 'Production'})
    .subscribe(({ flagKeyName }) => {
      this.accountService.setAccount({ id: this.currentAccountId, initialized: true, organizationName });
      // this.router.navigateByUrl(`/switch-manage/${encodeURIComponentFfc(flagKeyName)}/targeting?tutorial=react`);
      this.router.navigateByUrl(`/switch-manage/${encodeURIComponentFfc(flagKeyName)}/targeting`);
    }, _ => {
      this.msg.error('保存失败，请稍后重试！');
    })
  }
}
