import { Component, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { MessageQueueService } from '@services/message-queue.service';
import { IProjectEnv } from '@shared/types';
import { CURRENT_PROJECT } from '@utils/localstorage-keys';
import { getPathPrefix, isNumeric, tryParseJSONObject, uuidv4, copyToClipboard } from "@utils/index";
import { editor } from "monaco-editor";
import { FeatureFlagService } from "@services/feature-flag.service";
import {
  FeatureFlag,
  IFeatureFlag,
  ISettingPayload, IVariationsPayload,
  VariationTypeEnum
} from "@features/safe/feature-flags/types/details";
import { IVariation } from "@shared/rules";
import { ExperimentService } from "@services/experiment.service";
import { ExperimentStatus, IExpt } from "@features/safe/experiments/types";
import { NzSelectComponent } from "ng-zorro-antd/select";

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
  isEditingVariations = false;
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
    this.featureFlagService.setTags(this.featureFlag).subscribe(_ => {
      this.message.success($localize`:@@common.operation-success:Operation succeeded`);
    });
  }

  onAddTag() {
    let actualTag = this.selectedTag.startsWith(this.createTagPrefix)
      ? this.selectedTag.replace(this.createTagPrefix, '').replace(/'/g, '').trim()
      : this.selectedTag.trim();

    this.featureFlag.addTag(actualTag);
    this.featureFlagService.setTags(this.featureFlag).subscribe(_ => {
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
      this.featureFlagService.setCurrentFeatureFlag(this.featureFlag);
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

  toggleVariationEditState(resetVariations: boolean = false): void {
    this.isEditingVariations = !this.isEditingVariations;

    if (resetVariations) {
      this.featureFlag.variations = JSON.parse(JSON.stringify(this.lastSavedVariations));
    }
  }

  saveVariations() {
    if (!this.validateVariationTypes()) {
      this.message.error($localize `:@@ff.variation.type-value-not-match:The type and value of the variation don't match`);
      return;
    }
    this.toggleVariationEditState();

    const { key, variationType, variations } = this.featureFlag;
    const payload: IVariationsPayload = {
      key,
      variationType: variationType || VariationTypeEnum.string,
      variations: variations.filter(v => !v.isInvalid)
    };

    this.featureFlagService.updateVariations(payload).subscribe({
      next: () => {
        this.featureFlagService.setCurrentFeatureFlag(this.featureFlag);
        this.message.success($localize `:@@common.operation-success:Operation succeeded`);
        this.isEditingTitle = false;
        this.setLastSavedVariations();
        this.messageQueueService.emit(this.messageQueueService.topics.FLAG_SETTING_CHANGED(this.key))
      },
      error: err => this.message.error(err.error)
    });
  }

  addVariationOption(): void {
    this.featureFlag.variations = [
      ...this.featureFlag.variations,
      {
        id: uuidv4(),
        value: null
      }
    ];
  }

  currentEditingVariation: IVariation = null;
  variationValueExpandVisible = false;
  expandReadonly = true;
  expandVariationOption(v: IVariation, readonly: boolean = false) {
    this.currentEditingVariation = {...v};
    this.variationValueExpandVisible = true;
    this.expandReadonly = readonly;
  }

  saveOptionValue() {
    this.featureFlag.variations = this.featureFlag.variations.map(v => {
      return v.id === this.currentEditingVariation.id ? {...this.currentEditingVariation} : v
    });

    this.variationValueExpandVisible = false;
  }

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

  deleteVariation(id: string): void {
    if(this.featureFlag.targetUsers?.find(x => x.variationId === id)?.keyIds?.length > 0) {
      this.message.warning($localize `:@@ff.variation-used-by-targeting-users:This variation is used by targeting users, remove the reference before it can be safely removed`);
      return;
    }

    if(this.featureFlag.rules.length > 0 && this.featureFlag.rules.find(x => x.variations.find(y => y.id === id))) {
      this.message.warning($localize `:@@ff.variation-used-by-rules:This variation is used by rules, remove the reference before it can be safely removed`);
      return;
    }

    if(this.featureFlag.fallthrough.variations.length > 0 && this.featureFlag.fallthrough.variations.find(x => x.id === id)) {
      this.message.warning($localize `:@@ff.variation-used-by-default-rule:This variation is used by default rule, remove the reference before it can be safely removed`);
      return;
    }

    if(this.featureFlag.disabledVariationId === id) {
      this.message.warning($localize `:@@ff.variation-used-by-off:This variation is used by the value returned when the feature flag is OFF, remove the reference before it can be safely removed`);
      return;
    }

    this.experimentService.getFeatureFlagVariationReferences(this.featureFlag.id, id).subscribe(res => {
      if (res.length === 0) {
        this.featureFlag.variations = this.featureFlag.variations.filter(d => d.id !== id);
      } else {
        this.variationExptReferences = [...res];
        this.exptReferenceModalVisible = true;
      }
    }, () => {
      this.message.error($localize `:@@common.operation-failed-try-again:Operation failed, please try again`);
    })
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
        this.featureFlagService.setCurrentFeatureFlag(this.featureFlag);
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
