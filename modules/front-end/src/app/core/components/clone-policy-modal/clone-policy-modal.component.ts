import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { slugify } from "@utils/index";
import { NzMessageService } from "ng-zorro-antd/message";
import { Router } from "@angular/router";
import { PolicyService } from "@services/policy.service";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { IPolicy } from "@features/safe/iam/types/policy";

@Component({
  selector: 'clone-policy-modal',
  standalone: false,
  templateUrl: './clone-policy-modal.component.html',
  styleUrl: './clone-policy-modal.component.less'
})
export class ClonePolicyModalComponent {
  private _visible: boolean = false;
  @Input()
  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.initForm();
    }
  }

  @Input()
  policy: IPolicy;

  @Output()
  close: EventEmitter<boolean> = new EventEmitter();

  form: FormGroup<{
    name: FormControl<string>;
    key: FormControl<string>;
    description: FormControl<string>;
  }>;

  constructor(
    private formBuilder: FormBuilder,
    private messageService: NzMessageService,
    private policyService: PolicyService,
    private router: Router
  ) { }

  initForm() {
    this.form = this.formBuilder.group({
      name: new FormControl('', {
        validators: [ Validators.required ]
      }),
      key: ['', [Validators.required], [this.keyAsyncValidator]],
      description: new FormControl(this.policy?.description ?? '', {
        validators: [ Validators.maxLength(512) ]
      }),
    });

    this.form.get('name').valueChanges.subscribe((name) => {
      this.nameChange(name);
    });
  }

  keyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.policyService.isKeyUsed(value as string)),
    map(isUsed => {
      switch (isUsed) {
        case true:
          return { error: true, duplicated: true };
        case undefined:
          return { error: true, unknown: true };
        default:
          return null;
      }
    }),
    first()
  );

  nameChange(name: string) {
    let keyControl = this.form.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  onClose(completed: boolean = false) {
    this.close.emit(completed);
  }

  isCloning: boolean = false;
  doClone() {
    this.isCloning = true;
    const payload = this.form.value;
    this.policyService.clone(this.policy.key, payload as any).subscribe({
      next: (res) => {
        this.isCloning = false;
        this.messageService.success($localize `:@@common.operation-success:Operation succeeded`);
        this.onClose(true);

        // navigate to the new policy detail page
        this.router.navigate(['/iam/policies', res.id, 'permission']).then();
      },
      error: () => {
        this.messageService.error($localize`:@@common.operation-failed:Operation failed`);
        this.isCloning = false;
      }
    });
  }
}
