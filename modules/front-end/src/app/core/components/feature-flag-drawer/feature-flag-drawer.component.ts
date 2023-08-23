import { Component, EventEmitter, Input, OnInit, Output, ViewChild } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { encodeURIComponentFfc, slugify, uuidv4 } from "@utils/index";
import { FormArray, FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from "@angular/forms";
import { debounceTime, finalize, first, map, switchMap } from "rxjs/operators";
import { FeatureFlagService } from "@services/feature-flag.service";
import { IFeatureFlag, isVariationValueValid } from "@features/safe/feature-flags/types/details";
import { Router } from "@angular/router";
import { NzSelectComponent } from "ng-zorro-antd/select";
import { IVariation } from "@shared/rules";
import { editor } from "monaco-editor";
import { IFeatureFlagCreationPayload } from "@features/safe/feature-flags/types/feature-flag";

@Component({
  selector: 'feature-flag-drawer',
  templateUrl: './feature-flag-drawer.component.html',
  styleUrls: ['./feature-flag-drawer.component.less']
})
export class FeatureFlagDrawerComponent implements OnInit {

  @Input() visible: boolean = false;
  @Output() onClose = new EventEmitter();

  basicForm: FormGroup;
  variationForm: FormGroup;
  defaultRuleForm: FormGroup;
  creating: boolean = false;

  constructor(
    private router: Router,
    private featureFlagService: FeatureFlagService,
    private fb: FormBuilder,
    private message: NzMessageService,
  ) {
    this.featureFlagService.getAllTags().subscribe(allTags => {
      this.allTags = allTags;
      this.currentAllTags = allTags;
      this.isLoadingTags = false;
    });
  }

  ngOnInit() {
    this.initForm();
  }

  nameChange(name: string) {
    let keyControl = this.basicForm.get('key')!;
    keyControl.setValue(slugify(name ?? ''));
    keyControl.markAsDirty();
  }

  initForm() {
    this.basicForm = this.fb.group({
      name: ['', Validators.required],
      key: ['', Validators.required, this.flagKeyAsyncValidator],
      description: ['', Validators.maxLength(512)]
    });

    this.basicForm.get('name').valueChanges.subscribe((event)=>{
      this.nameChange(event);
    })

    this.defaultRuleForm = this.fb.group({
      isEnabled: [false, Validators.required],
      enabledVariationId: ['', Validators.required],
      disabledVariationId: ['', Validators.required]
    });

    this.variationForm = this.fb.group({
      variationType: ['boolean', Validators.required],
      variations: this.fb.array([]),
    });

    this.variationForm.get('variationType').valueChanges.subscribe((event)=>{
      this.setVariations(event);
    })

    this.setVariations('boolean');
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


  //#region tags
  allTags: string[] = [];
  currentAllTags: string[] = [];
  selectedTag: string = '';
  selectedTags: string[] = [];
  isLoadingTags: boolean = true;
  @ViewChild('tags') tagsSelect: NzSelectComponent;
  createTagPrefix = $localize`:@@common.create-tag:Create Tag`;

  isTagSelected(tag: string): boolean {
    return this.selectedTags.includes(tag);
  }

  onSearchTag(value: string) {
    this.currentAllTags = [...this.allTags];

    if (!value) {
      return;
    }

    if (this.currentAllTags.findIndex(x => x.startsWith(value)) === -1) {
      this.currentAllTags = [`${this.createTagPrefix} '${value}'`];
    }
  }

  onRemoveTag(tag: string) {
    this.selectedTags = this.selectedTags.filter(x => x !== tag);
  }

  onAddTag() {
    let actualTag = this.selectedTag.startsWith(this.createTagPrefix)
      ? this.selectedTag.replace(this.createTagPrefix, '').replace(/'/g, '').trim()
      : this.selectedTag.trim();

    this.selectedTags = [...this.selectedTags, actualTag];

    this.allTags = [...this.allTags, actualTag];
    this.currentAllTags = this.allTags;
    // clear current selected
    this.tagsSelect.writeValue(null);
  }
  //#endregion

  //#region variation settings
  get variations(): FormArray {
    return this.variationForm.get('variations') as FormArray;
  }

  get showDeleteVariationButton(): boolean {
    return this.variationType !== 'boolean' && this.variations.length > 1;
  }

  get showExpandVariationIcon(): boolean {
    return ['json', 'string'].includes(this.variationType);
  }

  get variationType(): string {
    return this.variationForm.get('variationType')!.value;
  }

  setVariations(variationType: string) {
    if (variationType === 'boolean') {
      this.variations.clear();
      this.addVariation('True', 'true', true);
      this.addVariation('False', 'false', true);

      this.setBooleanDefaultVariations();
      return;
    }

    // enable value inputs
    this.enableVariations();
  }

  private setBooleanDefaultVariations() {
    const trueId = this.variations.at(0).value['id'];
    const falseId = this.variations.at(1).value['id'];

    this.defaultRuleForm.get('enabledVariationId').setValue(trueId);
    this.defaultRuleForm.get('disabledVariationId').setValue(falseId);
  }

  private enableVariations() {
    this.variations.controls.forEach((control) => control.enable());
  }

  addVariation(name: string, value: string, valueDisabled: boolean = false) {
    const id = uuidv4();
    const variationForm = this.fb.group({
      id: [id, Validators.required],
      name: [name, Validators.required],
      value: [{ disabled: valueDisabled, value }, this.variationValueValidator]
    });

    this.variations.push(variationForm);
  }

  variationValueValidator: ValidatorFn = (control: FormControl) => {
    if (!control.value) {
      return { required: true };
    }

    return isVariationValueValid(this.variationType, control.value) ? null : { invalid: true };
  };

  removeVariation(index: number) {
    const { id } = this.variations.at(index).value;
    this.variations.removeAt(index);

    if (this.defaultRuleForm.value['enabledVariationId'] === id) {
      this.defaultRuleForm.get('enabledVariationId').setValue('');
    }

    if (this.defaultRuleForm.value['disabledVariationId'] === id) {
      this.defaultRuleForm.get('disabledVariationId').setValue('');
    }
  }

  currentEditingVariation: IVariation = null;
  variationValueExpandVisible: boolean = false;

  expandVariationOption(index: number) {
    const { id, name, value } = this.variations.at(index).value;
    this.currentEditingVariation = {id, name, value};
    this.variationValueExpandVisible = true;
  }

  saveVariationValue() {
    const variationsForm = this.fb.array(this.variations.controls.map((variationControl) => {
      const { id, name } = variationControl.value;

      if (id === this.currentEditingVariation.id) {
        return this.fb.group({
          id: [id, Validators.required],
          name: [name, Validators.required],
          value: [this.currentEditingVariation.value, Validators.required]
        });
      } else {
        return variationControl;
      }
    }));

    this.variationForm.setControl('variations', variationsForm);
    this.variationValueExpandVisible = false;
  }

  editor?: editor.ICodeEditor | editor.IEditor;

  formatCode(e?: editor.ICodeEditor | editor.IEditor) {
    if (e) {
      this.editor = e;
    }

    // @ts-ignore
    setTimeout(async () => {
      await this.editor.getSupportedActions().find(act => act.id === 'editor.action.formatDocument')?.run();
    }, 100);
  }
  //#endregion

  close() {
    this.initForm();
    this.onClose.emit();
  }

  doSubmit() {
    let invalid = false;
    if (this.basicForm.invalid) {
      for (const i in this.basicForm.controls) {
        this.basicForm.controls[i].markAsDirty();
        this.basicForm.controls[i].updateValueAndValidity();
      }
      invalid = true;
    }

    // validate variations
    if (this.variationForm.invalid) {
      for (const i in this.variationForm.controls) {
        this.variationForm.controls[i].markAsDirty();
        this.variationForm.controls[i].updateValueAndValidity();
      }
      invalid = true;
    }

    if (this.variations.invalid) {
      for (let control of this.variations.controls) {
        const variationForm: FormGroup = control as FormGroup
        for (const i in variationForm.controls) {
          variationForm.controls[i].markAsDirty();
          variationForm.controls[i].updateValueAndValidity();
        }
      }
      invalid = true;
    }

    if (this.defaultRuleForm.invalid) {
      for (const i in this.defaultRuleForm.controls) {
        this.defaultRuleForm.controls[i].markAsDirty();
        this.defaultRuleForm.controls[i].updateValueAndValidity();
      }
      invalid = true;
    }

    if (invalid) {
      return;
    }

    this.creating = true;

    // enable value inputs, so we can get the variaton values for boolean variation type
    this.enableVariations();

    const { name, key, description } = this.basicForm.value;
    const { isEnabled, enabledVariationId, disabledVariationId } = this.defaultRuleForm.value;

    const payload: IFeatureFlagCreationPayload = {
      name,
      key,
      description,
      tags: this.selectedTags,
      variationType: this.variationType,
      variations: this.variations.value,
      isEnabled,
      enabledVariationId,
      disabledVariationId
    };

    this.featureFlagService.create(payload)
      .pipe(finalize(() => this.creating = false))
      .subscribe({
        next: (result: IFeatureFlag) => this.navigateToFlagDetail(result.key),
        error: () => this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`)
      });
  }

  public navigateToFlagDetail(key: string) {
    this.router.navigateByUrl(`/feature-flags/${encodeURIComponentFfc(key)}/targeting`).then();
  }
}
