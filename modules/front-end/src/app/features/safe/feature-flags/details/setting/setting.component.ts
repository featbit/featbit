import { Component, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { MessageQueueService } from '@services/message-queue.service';
import { copyToClipboard, getPathPrefix, uuidv4 } from "@utils/index";
import { editor } from "monaco-editor";
import { FeatureFlagService } from "@services/feature-flag.service";
import {
  FeatureFlag,
  IFeatureFlag,
  isVariationValueValid,
  VariationTypeEnum
} from "@features/safe/feature-flags/types/details";
import { IVariation } from "@shared/rules";
import { ExperimentService } from "@services/experiment.service";
import { ExperimentStatus, IExpt } from "@features/safe/experiments/types";
import { NzSelectComponent } from "ng-zorro-antd/select";
import { FormArray, FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from "@angular/forms";
import { PermissionsService } from "@services/permissions.service";
import { permissionActions } from "@shared/policy";
import { PermissionLicenseService } from "@services/permission-license.service";
import { finalize } from "rxjs/operators";
import { handleUpdateError } from "@features/safe/feature-flags/types/feature-flag";

@Component({
    selector: 'ff-setting',
    templateUrl: './setting.component.html',
    styleUrls: ['./setting.component.less'],
    standalone: false
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

  revision: string = '';
  featureFlag: FeatureFlag = {} as FeatureFlag;
  isLoading = true;
  isEditingTitle = false;
  isEditingDescription = false;
  key: string = null;

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
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagTags);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const isNewTag = this.selectedTag.startsWith(this.createTagPrefix);

    const actualTag = isNewTag
      ? this.selectedTag.replace(this.createTagPrefix, '').replace(/'/g, '').trim()
      : this.selectedTag.trim();

    this.featureFlag.addTag(actualTag);
    this.featureFlagService.setTags(this.featureFlag.key, this.featureFlag.tags).subscribe(_ => {
      this.message.success($localize`:@@common.operation-success:Operation succeeded`);
    });

    if (isNewTag) {
      this.allTags = [...this.allTags, actualTag];
    }

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
    private router: Router,
    private permissionsService: PermissionsService,
    private permissionLicenseService: PermissionLicenseService,
    private modal: NzModalService
  ) {
    this.route.paramMap.subscribe( paramMap => {
      this.key = decodeURIComponent(paramMap.get('key'));
      this.messageQueueService.subscribe(
        this.messageQueueService.topics.FLAG_TARGETING_CHANGED(this.key),
        (revision: string) => this.revision = revision
      );
      this.loadData();
    });

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
    this.isLoading = true;
    this.featureFlagService.getByKey(this.key)
    .pipe(finalize(() => this.isLoading = false))
    .subscribe({
      next: (result: IFeatureFlag) => {
        this.featureFlag = new FeatureFlag(result);
        this.revision = result.revision;
      },
      error: () => this.message.error($localize`:@@common.failed-to-load-data:Failed to load data`)
    });
  }

  isToggling: boolean = false;
  onChangeStatus() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.ToggleFlag);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const { isEnabled } = this.featureFlag;

    this.isToggling = true;
    this.featureFlagService.toggleStatus(this.key, !isEnabled)
    .pipe(finalize(() => this.isToggling = false))
    .subscribe({
      next: (revision) => {
        this.featureFlag.isEnabled = !isEnabled;
        this.onSettingUpdated(revision);
      },
      error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }

  toggleTitleEditState(): void {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagName);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.isEditingTitle = !this.isEditingTitle;
  }

  toggleDescriptionEditState(): void {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagDescription);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.isEditingDescription = !this.isEditingDescription;
  }

  //#region variations form

  variationForm: FormGroup;

  get variations(): FormArray {
    return this.variationForm.get('variations') as FormArray;
  }

  get variationType(): string {
    return this.variationForm.get('variationType')!.value;
  }

  get showDeleteVariationButton(): boolean {
    return this.variationType !== VariationTypeEnum.boolean && this.variations.length > 1;
  }

  get showExpandVariationIcon(): boolean {
    return ['json', 'string'].includes(this.variationType);
  }

  editVariationModalVisible: boolean = false;
  editVariations(): void {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagVariations);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const { variationType, variations } = this.featureFlag;

    this.variationForm = this.formBuilder.group({
      variationType: [{ value: variationType, disabled: true }],
      variations: this.formBuilder.array([])
    });

    // init variations
    variations.forEach(variation => this.variations.push(this.createVariationFormGroup(variation, variationType)));

    this.editVariationModalVisible = true;
  }

  newVariation() {
    const newVariation = {
      id: uuidv4(),
      name: '',
      value: ''
    };

    const formGroup = this.createVariationFormGroup(newVariation, this.variationType);
    this.variations.push(formGroup);
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

    this.experimentService.getVariationReferences(this.featureFlag.id, id).subscribe({
      next: (references) => {
        if (references.length === 0) {
          this.variations.removeAt(index);
        } else {
          this.variationExptReferences = [...references];
          this.exptReferenceModalVisible = true;
        }
      },
      error: () => this.message.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`)
    });
  }

  saveVariations() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagVariations);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (!this.variationForm.valid) {
      return;
    }

    const variations = this.variations.getRawValue();
    this.featureFlagService.updateVariations(this.key, variations, this.revision).subscribe({
      next: (revision) => {
        this.featureFlag.variations = variations;
        this.editVariationModalVisible = false;
        this.onSettingUpdated(revision);
      },
      error: (err) => handleUpdateError(err, this.message, this.modal)
    });
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

  // private methods
  private createVariationFormGroup(variation: IVariation, variationType: string): FormGroup {
    const isValueDisabled = variationType == VariationTypeEnum.boolean;
    return this.formBuilder.group({
      id: [variation.id, Validators.required],
      name: [variation.name, Validators.required],
      value: [
        {
          value: variation.value,
          disabled: isValueDisabled
        },
        this.variationValueValidator
      ]
    });
  }

  variationValueValidator: ValidatorFn = (control: FormControl) => {
    if (!control.value) {
      return { required: true };
    }

    return isVariationValueValid(this.variationType, control.value) ? null : { invalid: true };
  };

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

  onSaveName() {
    const { name } = this.featureFlag;

    this.featureFlagService.updateName(this.key, name).subscribe({
      next: (revision) => {
        this.isEditingTitle = false;
        this.onSettingUpdated(revision);
      },
      error: err => this.message.error(err.error)
    });
  }

  onSaveDescription() {
    const { description } = this.featureFlag;

    this.featureFlagService.updateDescription(this.key, description).subscribe({
      next: (revision) => {
        this.isEditingDescription = false;
        this.onSettingUpdated(revision);
      },
      error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }

  onSaveOffVariation() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagOffVariation);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const { disabledVariationId } = this.featureFlag;

    this.featureFlagService.updateOffVariation(this.key, disabledVariationId, this.revision).subscribe({
      next: (revision) => {
        this.isEditingTitle = false;
        this.onSettingUpdated(revision);
      },
      error: (err) => handleUpdateError(err, this.message, this.modal)
    });
  }

  restoreFlag() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.RestoreFlag);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.featureFlagService.restore(this.featureFlag.key).subscribe(_ => {
      this.featureFlag.isArchived = false;
      this.message.success($localize `:@@common.operation-success:Operation succeeded`);
      this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key));
    });
  }

  deleteFlag() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.DeleteFlag);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.featureFlagService.delete(this.featureFlag.key).subscribe(success => {
      if (success) {
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        this.router.navigateByUrl('/feature-flags');
      } else {
        this.message.error($localize `:@@common.operation-failed:Operation failed`);
      }
    });
  }

  private onSettingUpdated(revision: string) {
    this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    this.revision = revision;
    this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key));
  }
}
