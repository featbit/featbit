import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IFeatureFlagListItem } from "@features/safe/feature-flags/types/feature-flag";
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { FeatureFlagService } from "@services/feature-flag.service";
import { slugify } from "@utils/index";
import { FlagKeyValidator } from "@shared/flag-key-validator.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { Router } from "@angular/router";
import { ResourceKeyPattern } from "@shared/types";

@Component({
  selector: 'clone-feature-flag-modal',
  standalone: false,
  templateUrl: './clone-feature-flag-modal.component.html',
  styleUrl: './clone-feature-flag-modal.component.less'
})
export class CloneFeatureFlagModalComponent {
  private _visible: boolean = false;
  @Input()
  get visible(): boolean {
    return this._visible;
  }

  set visible(value: boolean) {
    this._visible = value;
    if (value) {
      this.initForm();
      this.loadTags();
    }
  }

  @Input()
  flag: IFeatureFlagListItem;

  @Output()
  close: EventEmitter<boolean> = new EventEmitter();

  form: FormGroup<{
    name: FormControl<string>;
    key: FormControl<string>;
    description: FormControl<string>;
    tags: FormControl<string[]>
  }>;

  constructor(
    private formBuilder: FormBuilder,
    private messageService: NzMessageService,
    private flagKeyAsyncValidator: FlagKeyValidator,
    private flagServices: FeatureFlagService,
    private router: Router
  ) { }

  initForm() {
    this.form = this.formBuilder.group({
      name: new FormControl('', {
        validators: [ Validators.required ]
      }),
      key: new FormControl('', {
        validators: [ Validators.required, Validators.pattern(ResourceKeyPattern) ],
        asyncValidators: [ this.flagKeyAsyncValidator.validate.bind(this.flagKeyAsyncValidator) ],
      }),
      description: new FormControl(this.flag?.description ?? '', {
        validators: [ Validators.maxLength(512) ]
      }),
      tags: new FormControl(this.flag?.tags ?? []),
    });

    this.form.get('name').valueChanges.subscribe((name) => {
      this.nameChange(name);
    });
  }

  nameChange(name: string) {
    let keyControl = this.form.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  isLoadingTags: boolean = true;
  allTags: string[] = [];
  loadTags() {
    this.isLoadingTags = true;
    this.flagServices.getAllTags().subscribe(allTags => {
      this.allTags = allTags;
      this.isLoadingTags = false;
    });
  }

  onClose(completed: boolean = false) {
    this.close.emit(completed);
  }

  isCloning: boolean = false;

  doClone() {
    this.isCloning = true;
    const payload = this.form.value;
    this.flagServices.clone(this.flag.key, payload as any).subscribe({
      next: () => {
        this.isCloning = false;
        this.messageService.success($localize `:@@common.operation-success:Operation succeeded`);
        this.onClose(true);

        // navigate to the new flag detail page
        this.router.navigate(['/feature-flags', payload.key, 'targeting']).then();
      },
      error: () => {
        this.messageService.error($localize`:@@common.operation-failed:Operation failed`);
        this.isCloning = false;
      }
    });
  }
}
