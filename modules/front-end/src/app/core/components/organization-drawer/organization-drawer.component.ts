import { Component, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { NzMessageService } from 'ng-zorro-antd/message';
import { OrganizationService } from '@services/organization.service';
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { slugify } from "@utils/index";

@Component({
  selector: 'organization-drawer',
  templateUrl: './organization-drawer.component.html',
  styleUrls: [ './organization-drawer.component.less' ]
})
export class OrganizationDrawerComponent {
  form: FormGroup;
  isLoading: boolean = false;

  private _visible: boolean = false;
  get visible(): boolean {
    return this._visible;
  }

  @Input()
  set visible(visible: boolean) {
    this._visible = visible;
    if (visible) {
      this.initForm();
    }
  }

  @Output() close: EventEmitter<any> = new EventEmitter();

  constructor(
    private fb: FormBuilder,
    private organizationService: OrganizationService,
    private message: NzMessageService
  ) {
    this.initForm();
  }

  initForm() {
    this.form = this.fb.group({
      name: [ '', [ Validators.required ] ],
      key: [ '', [ Validators.required ], [ this.keyAsyncValidator ] ],
    });

    this.form.get('name').valueChanges.subscribe(name => this.nameChange(name));
  }

  nameChange(name: string) {
    let keyControl = this.form.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  keyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.organizationService.isKeyUsed(value as string)),
    map(isKeyUsed => {
      switch (isKeyUsed) {
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

  onClose() {
    this.form.reset();
    this.close.emit();
  }

  doSubmit() {
    this.isLoading = true;

    const { name, key } = this.form.value;
    this.organizationService.create({ name, key }).subscribe({
      next: org => {
        this.isLoading = false;
        this.close.emit(org);
        this.message.success($localize`:@@org.org.orgCreated:Organization successfully created!`);
      }, error: _ => {
        this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
        this.isLoading = false;
      }
    });
  }
}
