import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { FeatureFlagService } from "@services/feature-flag.service";
import { slugify } from "@utils/index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'create-feature-flag',
  templateUrl: './create-feature-flag.component.html',
  styleUrls: ['./create-feature-flag.component.less']
})
export class CreateFeatureFlagComponent implements OnInit{

  @Input() flag: IFeatureFlag;
  @Output() onComplete = new EventEmitter<IFeatureFlag>();

  variationTypeBoolean = 'boolean';
  form: FormGroup;

  constructor(
    private fb: FormBuilder,
    private featureFlagService: FeatureFlagService,
    private message: NzMessageService,
  ) {
  }

  ngOnInit() {
    let name: string = '';
    let key: string = '';
    let description: string = '';

    if (this.flag) {
      name = this.flag.name;
      key = this.flag.key;
      description = this.flag.description;
    }

    this.form = this.fb.group({
      name: [name, Validators.required],
      key: [key, Validators.required, this.flagKeyAsyncValidator],
      description:[description,Validators.maxLength(512)]
    });
  }

  flagKeyAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.featureFlagService.isKeyUsed(value as string)),
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

  onNameChange(name: string) {
    let keyControl = this.form.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  createFlag() {
    this.featureFlagService.create(this.form.value).subscribe({
      next: (result: IFeatureFlag) => {
        this.onComplete.emit(result);
      },
      error: (err) => {
        this.message.error(err.error);
      }
    });
  }
}
