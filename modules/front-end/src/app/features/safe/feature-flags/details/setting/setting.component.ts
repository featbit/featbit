import { Component, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { MessageQueueService } from '@services/message-queue.service';
import { copyToClipboard, uuidv4 } from "@utils/index";
import { editor } from "monaco-editor";
import { FeatureFlagService } from "@services/feature-flag.service";
import {
  FeatureFlag,
  IFeatureFlag,
  isVariationValueValid,
  VariationTypeEnum
} from "@features/safe/feature-flags/types/details";
import { IVariation } from "@shared/rules";
import { NzSelectComponent } from "ng-zorro-antd/select";
import { FormArray, FormBuilder, FormControl, FormGroup, ValidatorFn, Validators } from "@angular/forms";
import { PermissionsService } from "@services/permissions.service";
import { permissionActions } from "@shared/policy";
import { PermissionLicenseService } from "@services/permission-license.service";
import { finalize } from "rxjs/operators";
import { handleUpdateError } from "@features/safe/feature-flags/types/feature-flag";
import { ChangeCommentService } from "@services/change-comment.service";
import { ChangeOperation } from "@core/components/change-comment/types";
import { Observable } from "rxjs";
import { getCurrentProjectEnv } from "@utils/project-env";
import { EnvironmentSetting } from "@shared/types";

@Component({
    selector: 'ff-setting',
    templateUrl: './setting.component.html',
    styleUrls: ['./setting.component.less'],
    standalone: false
})
export class SettingComponent {
  envSettings: EnvironmentSetting;

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
  pendingTags: string[] = [];
  @ViewChild('tags') tagsSelect: NzSelectComponent;
  createTagPrefix = $localize`:@@common.create-tag:Create Tag`;

  get hasPendingTagChanges(): boolean {
    const saved = this.featureFlag.tags ?? [];
    if (this.pendingTags.length !== saved.length) return true;
    const sorted1 = [...this.pendingTags].sort();
    const sorted2 = [...saved].sort();
    return sorted1.some((t, i) => t !== sorted2[i]);
  }

  isTagSelected(tag: string): boolean {
    return this.pendingTags.includes(tag);
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

  onRemoveTag(event: MouseEvent, tag: string) {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagTags);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.pendingTags = this.pendingTags.filter(t => t !== tag);
  }

  onAddTag() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagTags);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (!this.selectedTag) return;

    const isNewTag = this.selectedTag.startsWith(this.createTagPrefix);
    const actualTag = isNewTag
      ? this.selectedTag.replace(this.createTagPrefix, '').replace(/'/g, '').trim()
      : this.selectedTag.trim();

    if (!this.pendingTags.includes(actualTag)) {
      this.pendingTags = [...this.pendingTags, actualTag];
    }

    if (isNewTag) {
      this.allTags = [...this.allTags, actualTag];
    }

    this.currentAllTags = this.allTags;
    this.tagsSelect.writeValue(null);
  }

  onSaveTags() {
    this.promptChangeComment(ChangeOperation.UpdateTags).subscribe(comment => {
      if (comment === null) return;
      this.featureFlagService.setTags(this.featureFlag.key, this.pendingTags, comment).subscribe(_ => {
        this.featureFlag.tags = [...this.pendingTags];
        this.message.success($localize`:@@common.operation-success:Operation succeeded`);
      });
    });
  }

  onCancelSaveTags() {
    this.pendingTags = [...(this.featureFlag.tags ?? [])];
    this.currentAllTags = this.allTags;
    this.tagsSelect.writeValue(null);
  }

  constructor(
    private route: ActivatedRoute,
    private featureFlagService: FeatureFlagService,
    private message: NzMessageService,
    private messageQueueService: MessageQueueService,
    private formBuilder: FormBuilder,
    private router: Router,
    private permissionsService: PermissionsService,
    private permissionLicenseService: PermissionLicenseService,
    private modal: NzModalService,
    private changeCommentService: ChangeCommentService
  ) {
    this.envSettings = getCurrentProjectEnv()!.envSettings;

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
        this.pendingTags = [...this.featureFlag.tags];
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

    const operation = this.featureFlag.isEnabled ? ChangeOperation.ToggleOff : ChangeOperation.ToggleOn;
    this.promptChangeComment(operation).subscribe(comment => {
      if (comment === null) return;
      const { isEnabled } = this.featureFlag;
      this.isToggling = true;
      this.featureFlagService.toggleStatus(this.key, !isEnabled, comment)
      .pipe(finalize(() => this.isToggling = false))
      .subscribe({
        next: (revision) => {
          this.featureFlag.isEnabled = !isEnabled;
          this.onSettingUpdated(revision);
        },
        error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
      });
    });
  }

  toggleTitleEditState(): void {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagName);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (this.isEditingTitle) {
      // Cancel editing, reset name to original value
      this.featureFlag.name = this.featureFlag.originalData.name;
    }

    this.isEditingTitle = !this.isEditingTitle;
  }

  toggleDescriptionEditState(): void {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagDescription);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (this.isEditingDescription) {
      // Cancel editing, reset description to original value
      this.featureFlag.description = this.featureFlag.originalData.description;
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

    this.variations.removeAt(index);
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
    this.promptChangeComment(ChangeOperation.ChangeVariations).subscribe(comment => {
      if (comment === null) return;
      this.featureFlagService.updateVariations(this.key, variations, this.revision, comment).subscribe({
        next: (revision) => {
          this.featureFlag.variations = variations;
          this.editVariationModalVisible = false;
          this.onSettingUpdated(revision);
        },
        error: (err) => handleUpdateError(err, this.message, this.modal)
      });
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

  onSaveName() {
    const { name } = this.featureFlag;

    this.promptChangeComment(ChangeOperation.ChangeName).subscribe(comment => {
      if (comment === null) return;
      this.featureFlagService.updateName(this.key, name, comment).subscribe({
        next: (revision) => {
          this.isEditingTitle = false;
          this.onSettingUpdated(revision);
        },
        error: err => this.message.error(err.error)
      });
    });
  }

  onSaveDescription() {
    const { description } = this.featureFlag;

    this.promptChangeComment(ChangeOperation.ChangeDescription).subscribe(comment => {
      if (comment === null) return;
      this.featureFlagService.updateDescription(this.key, description, comment).subscribe({
        next: (revision) => {
          this.isEditingDescription = false;
          this.onSettingUpdated(revision);
        },
        error: () => this.message.error($localize`:@@common.operation-failed:Operation failed`)
      });
    });
  }

  @ViewChild('offVariationSelect') offVariationSelect: NzSelectComponent;
  onSaveOffVariation(newOffVariationId: string) {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.UpdateFlagOffVariation);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.promptChangeComment(ChangeOperation.ChangeOffVariation).subscribe(comment => {
      if (comment === null) {
        // revert to original off variation if user cancels the change comment prompt
        this.offVariationSelect.writeValue(this.featureFlag.disabledVariationId);
        return;
      }

      this.featureFlagService.updateOffVariation(this.key, newOffVariationId, this.revision, comment).subscribe({
        next: (revision) => {
          this.isEditingTitle = false;
          this.featureFlag.disabledVariationId = newOffVariationId;
          this.onSettingUpdated(revision);
        },
        error: (err) => handleUpdateError(err, this.message, this.modal)
      });
    });
  }

  restoreFlag() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.RestoreFlag);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.promptChangeComment(ChangeOperation.Restore).subscribe(comment => {
      if (comment === null) return;
      this.featureFlagService.restore(this.featureFlag.key, comment).subscribe(_ => {
        this.featureFlag.isArchived = false;
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key));
      });
    });
  }

  deleteFlag() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.featureFlag.rn, permissionActions.DeleteFlag);
    if (!isGranted) {
      this.message.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.promptChangeComment(ChangeOperation.Delete).subscribe(comment => {
      if (comment === null) return;
      this.featureFlagService.delete(this.featureFlag.key, comment).subscribe(success => {
        if (success) {
          this.message.success($localize `:@@common.operation-success:Operation succeeded`);
          this.router.navigateByUrl('/feature-flags');
        } else {
          this.message.error($localize `:@@common.operation-failed:Operation failed`);
        }
      });
    });
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }

  private promptChangeComment(operation: ChangeOperation): Observable<string | null> {
    return this.changeCommentService.promptFlag(this.key, operation);
  }

  private onSettingUpdated(revision: string) {
    this.message.success($localize `:@@common.operation-success:Operation succeeded`);
    this.revision = revision;
    this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key));
  }
}
