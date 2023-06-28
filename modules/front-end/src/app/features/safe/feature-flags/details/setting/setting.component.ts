import { Component, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { MessageQueueService } from '@services/message-queue.service';
import { IProjectEnv } from '@shared/types';
import { CURRENT_PROJECT } from '@utils/localstorage-keys';
import { copyToClipboard, getPathPrefix, isNumeric, tryParseJSONObject, uuidv4 } from "@utils/index";
import { editor } from "monaco-editor";
import { FeatureFlagService } from "@services/feature-flag.service";
import {
  FeatureFlag,
  IFeatureFlag,
  ISettingPayload,
  IVariationsPayload,
  VariationTypeEnum
} from "@features/safe/feature-flags/types/details";
import { IVariation } from "@shared/rules";
import { ExperimentService } from "@services/experiment.service";
import { ExperimentStatus, IExpt } from "@features/safe/experiments/types";
import { NzSelectComponent } from "ng-zorro-antd/select";
import { FormArray, FormBuilder, FormGroup, Validators } from "@angular/forms";

@Component({
  selector: 'ff-setting',
  templateUrl: './setting.component.html',
  styleUrls: ['./setting.component.less']
})
export class SettingComponent {

  trackById(_, v: IVariation) {
    return v.id;
  }

  compareWith(o1: string, o2: string): boolean {
    if (!o1 || !o2) {
      return false;
    }

    return o1 === o2;
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }

  lastSavedVariations: IVariation[];
  setLastSavedVariations() {
    this.lastSavedVariations = JSON.parse(JSON.stringify(this.featureFlag.variations));
  }

  featureFlag: FeatureFlag = {} as FeatureFlag;
  isLoading = true;
  isEditingTitle = false;
  isEditingDescription = false;
  key: string = null;
  currentProjectEnv: IProjectEnv = null;

  allTags: string[] = [];
  currentAllTags: string[] = [];
  selectedTag: string = '';
  isLoadingTags: boolean = true;
  @ViewChild('tags') tagsSelect: NzSelectComponent;
  createTagPrefix = $localize`:@@common.create-tag:Create Tag`;

  isTagSelected(tag: string): boolean {
    return this.featureFlag.tags.includes(tag);
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
    this.featureFlag.removeTag(tag);
    this.featureFlagService.setTags(this.featureFlag.key, this.featureFlag.tags).subscribe(_ => {
      this.message.success($localize`:@@common.operation-success:Operation succeeded`);
    });
  }

  onAddTag() {
    let actualTag = this.selectedTag.startsWith(this.createTagPrefix)
      ? this.selectedTag.replace(this.createTagPrefix, '').replace(/'/g, '').trim()
      : this.selectedTag.trim();

    this.featureFlag.addTag(actualTag);
    this.featureFlagService.setTags(this.featureFlag.key, this.featureFlag.tags).subscribe(_ => {
      this.message.success($localize`:@@common.operation-success:Operation succeeded`);
    });

    this.allTags = [...this.allTags, actualTag];
    this.currentAllTags = this.allTags;
    // clear current selected
    this.tagsSelect.writeValue(null);
  }

  constructor(
    private route: ActivatedRoute,
    private featureFlagService: FeatureFlagService,
    private experimentService: ExperimentService,
    private message: NzMessageService,
    private messageQueueService: MessageQueueService,
    private formBuilder: FormBuilder,
    private router: Router
  ) {
    this.isLoading = true;
    this.currentProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT()));
    this.route.paramMap.subscribe( paramMap => {
      this.key = decodeURIComponent(paramMap.get('key'));
      this.messageQueueService.subscribe(this.messageQueueService.topics.FLAG_TARGETING_CHANGED(this.key), () => this.loadData());
      this.loadData();
    })

    this.featureFlagService.getAllTags().subscribe(allTags => {
      this.allTags = allTags;
      this.currentAllTags = allTags;
      this.isLoadingTags = false;
    });
  }
  editor?: editor.ICodeEditor | editor.IEditor;
  formatCode(e?: editor.ICodeEditor | editor.IEditor) {
    if (e) {
      this.editor = e;
    }

    // @ts-ignore
    setTimeout(async () => {
      if (this.expandReadonly) {
        this.editor.updateOptions({readOnly: false});
      }

      await this.editor.getSupportedActions().find(act => act.id === 'editor.action.formatDocument')?.run();
      this.editor.updateOptions({readOnly: this.expandReadonly});
    }, 100);
  }

  private loadData() {
    this.featureFlagService.getByKey(this.key).subscribe((result: IFeatureFlag) => {
      this.featureFlag = new FeatureFlag(result);
      this.setLastSavedVariations();
      this.isLoading = false;
    }, () => this.isLoading = false)
  }

  onSaveDescription() {
    this.onSaveSettings();
  }

  onChangeStatus() {
    this.featureFlag.isEnabled = !this.featureFlag.isEnabled;
    this.onSaveSettings(() => this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key)));
  }

  onChangeDisabledVariation() {
    this.onSaveSettings(() => this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key)));
  }

  toggleTitleEditState(): void {
    this.isEditingTitle = !this.isEditingTitle;
  }

  toggleDescriptionEditState(): void {
    this.isEditingDescription = !this.isEditingDescription;
  }

  //#region variations

  variationForm: FormGroup;

  get variations(): FormArray {
    return this.variationForm.get('variations') as FormArray;
  }

  get variationType(): string {
    return this.variationForm.get('variationType')!.value;
  }

  get showDeleteVariationButton(): boolean {
    return this.variationType !== 'boolean' && this.variations.length > 1;
  }

  get showExpandVariationIcon(): boolean {
    return ['json', 'string'].includes(this.variationType);
  }

  deleteVariation(index: number): void {
    const { id } = this.variations.at(index).value;

    if (this.featureFlag.targetUsers?.find(x => x.variationId === id)?.keyIds?.length > 0) {
      this.message.warning($localize`:@@ff.variation-used-by-targeting-users:This variation is used by targeting users, remove the reference before it can be safely removed`);
      return;
    }

    if (this.featureFlag.rules.length > 0 && this.featureFlag.rules.find(x => x.variations.find(y => y.id === id))) {
      this.message.warning($localize`:@@ff.variation-used-by-rules:This variation is used by rules, remove the reference before it can be safely removed`);
      return;
    }

    if (this.featureFlag.fallthrough.variations.length > 0 && this.featureFlag.fallthrough.variations.find(x => x.id === id)) {
      this.message.warning($localize`:@@ff.variation-used-by-default-rule:This variation is used by default rule, remove the reference before it can be safely removed`);
      return;
    }

    if (this.featureFlag.disabledVariationId === id) {
      this.message.warning($localize`:@@ff.variation-used-by-off:This variation is used by the value returned when the feature flag is OFF, remove the reference before it can be safely removed`);
      return;
    }

    this.experimentService.getFeatureFlagVariationReferences(this.featureFlag.id, id).subscribe(res => {
      if (res.length === 0) {
        this.variations.removeAt(index);
      } else {
        this.variationExptReferences = [...res];
        this.exptReferenceModalVisible = true;
      }
    }, () => {
      this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
    })
  }

  onVariationTypeChanged(variationType: string) {
    if (this.featureFlag.variationType === VariationTypeEnum.boolean && variationType === VariationTypeEnum.boolean) {
      // TODO: use original value
    }

    this.variations.controls.forEach(control => {
      let formGroup = control as FormGroup;
      if (variationType === VariationTypeEnum.boolean) {
        formGroup.controls.value.disable();
      } else {
        formGroup.controls.value.enable();
      }
    });
  }

  addVariation(name: string, value: string, valueDisabled: boolean = false) {
    const id = uuidv4();
    const variationForm = this.formBuilder.group({
      id: [id, Validators.required],
      name: [name, Validators.required],
      value: [{ disabled: valueDisabled, value }, Validators.required]
    });

    this.variations.push(variationForm);
  }

  editVariationModalVisible: boolean = false;
  editVariations(resetVariations: boolean = false): void {
    const { variationType, variations } = this.featureFlag;
    const canEditValue = variationType === VariationTypeEnum.boolean;
    this.variationForm = this.formBuilder.group({
      variationType: [variationType, Validators.required],
      variations: this.formBuilder.array(
        variations.map(variation =>
          this.formBuilder.group({
            id: [variation.id, Validators.required],
            name: [variation.name, Validators.required],
            value: [
              {
                disabled: canEditValue,
                value: variation.value
              }, Validators.required]
          })
        )
      )
    });

    this.editVariationModalVisible = true;

    // TODO: remove this
    if (resetVariations) {
      this.featureFlag.variations = JSON.parse(JSON.stringify(this.lastSavedVariations));
    }
  }

  saveVariations() {
    if (!this.validateVariationTypes()) {
      this.message.error($localize `:@@ff.variation.type-value-not-match:The type and value of the variation don't match`);
      return;
    }

    const { key, variations } = this.featureFlag;
    const payload: IVariationsPayload = {
      key,
      variations: variations.filter(v => !v.isInvalid)
    };

    console.log(payload);

    // TODO: uncomment this
    // this.featureFlagService.updateVariations(payload).subscribe({
    //   next: () => {
    //     this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    //     this.isEditingTitle = false;
    //     this.setLastSavedVariations();
    //     this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key))
    //   },
    //   error: err => this.message.error(err.error)
    // });
  }

  currentEditingVariation: IVariation = null;
  variationValueExpandVisible = false;
  expandReadonly = true;

  expandVariation(variation: IVariation, readonly: boolean = false) {
    this.currentEditingVariation = { ...variation };
    this.variationValueExpandVisible = true;
    this.expandReadonly = readonly;
  }

  updateVariationValue() {
    for (const control of this.variations.controls) {
      let formGroup = control as FormGroup;
      if (formGroup.controls.id.value === this.currentEditingVariation.id) {
        formGroup.controls.value.setValue(this.currentEditingVariation.value);
        break;
      }
    }

    this.variationValueExpandVisible = false;
  }

  //#endregion

  exptStatusNotStarted: ExperimentStatus = ExperimentStatus.NotStarted;
  exptStatusPaused: ExperimentStatus = ExperimentStatus.Paused;
  exptStatusRecording: ExperimentStatus = ExperimentStatus.Recording;

  goToExperimentPage(featureFlagKey: string, exptId: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`${getPathPrefix()}feature-flags/${featureFlagKey}/experimentations`], { fragment: exptId })
    );

    window.open(url, '_blank');
  }

  exptReferenceModalVisible = false;

  variationExptReferences: IExpt[] = [];
  closeExptReferenceModal() {
    this.exptReferenceModalVisible = false;
  }

  isValidVariationOption(v: IVariation): boolean {
    return !!v && v.value !== null && v.value.trim() !== '' && this.validateVariationDataType(v.value);
  }

  validateVariationTypes(): boolean {
      this.featureFlag.variations = this.featureFlag.variations.map(v => ({...v, isInvalid: !this.isValidVariationOption(v)}));
      return !this.featureFlag.variations.some(v => v.isInvalid);
  }

  validateVariation(variation: IVariation) {
    variation.isInvalid = !this.validateVariationDataType(variation.value);
  }

  //!isNaN(parseFloat(num)) && isFinite(num);
  validateVariationDataType(value: string): boolean {
    switch (this.featureFlag.variationType) {
      case VariationTypeEnum.string:
        // the real value is always string
        return value.trim().length > 0;
      case VariationTypeEnum.boolean:
        return value === 'true' || value === 'false';
      case VariationTypeEnum.number:
        return isNumeric(value);
      case VariationTypeEnum.json:
        return tryParseJSONObject(value);
      default:
        return false;
    }
  }

  onSaveSettings(cb?: Function) {
    const { key, name, description, isEnabled, variationType, disabledVariationId, variations } = this.featureFlag;
    const payload: ISettingPayload = {
      key,
      name,
      description,
      isEnabled,
      variationType: variationType || VariationTypeEnum.string,
      disabledVariationId,
      variations: variations.filter(v => !v.isInvalid)
    };

    this.featureFlagService.updateSetting(payload).subscribe({
      next: () => {
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        this.isEditingTitle = false;
        this.isEditingDescription = false;
        cb && cb();
      },
      error: err => this.message.error(err.error)
    });
  }

  restoreFlag() {
    this.featureFlagService.restore(this.featureFlag.key).subscribe(_ => {
      this.featureFlag.isArchived = false;
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key));
    });
  }

  deleteFlag() {
    this.featureFlagService.delete(this.featureFlag.key).subscribe(success => {
      if (success) {
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        this.router.navigateByUrl('/feature-flags');
      } else {
        this.message.error($localize `:@@common.operation-failed:Operation failed`);
      }
    });
  }
}
