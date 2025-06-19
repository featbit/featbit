import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormControl, FormGroup, Validators } from "@angular/forms";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { SegmentService } from "@services/segment.service";
import { CreateSegment, ISegment, SegmentType } from "@features/safe/segments/types/segments-index";
import { NzMessageService } from "ng-zorro-antd/message";
import {
  GroupedResource,
  groupResources,
  isChildResourceOf,
  ResourceSpaceLevel,
  ResourceTypeEnum,
  ResourceV2
} from "@shared/policy";
import { getCurrentLicense, getCurrentOrganization, getCurrentProjectEnv } from "@utils/project-env";
import { LicenseFeatureEnum } from "@shared/types";

@Component({
  selector: 'segment-creation-modal',
  templateUrl: './segment-creation-modal.component.html',
  styleUrls: [ './segment-creation-modal.component.less' ]
})
export class SegmentCreationModalComponent {
  private _isVisible: boolean = false;
  get isVisible() {
    return this._isVisible;
  }
  @Input()
  set isVisible(visible: boolean) {
    this._isVisible = visible;
    if (visible) {
      this.init();
    }
  }

  @Output()
  onClose: EventEmitter<ISegment> = new EventEmitter<ISegment>();

  form: FormGroup<{
    name: FormControl<string>,
    description: FormControl<string>
  }>;

  selectedType: SegmentType = SegmentType.EnvironmentSpecific;
  types: string[] = [
    $localize`:@@segment.current-environment:Current Environment`,
    $localize`:@@segment.shareable:Shareable`
  ]

  typeChanged(type: number) {
    this.selectedType = type == 0 ? SegmentType.EnvironmentSpecific : SegmentType.Shared;
    this.form.reset();
  }

  isShareableSegmentGranted: boolean = false;
  currentEnvironment: ResourceV2;

  constructor(
    private service: SegmentService,
    private msg: NzMessageService
  ) { }

  init() {
    this.form = new FormGroup({
      name: new FormControl('', [ Validators.required ], [ this.segmentNameAsyncValidator ]),
      description: new FormControl('')
    });

    const currentOrg = getCurrentOrganization();
    const curProjectEnv = getCurrentProjectEnv();

    this.currentEnvironment = {
      id: curProjectEnv.envId,
      name: curProjectEnv.envName,
      pathName: `${currentOrg.name}/${curProjectEnv.projectName}/${curProjectEnv.envName}`,
      rn: `organization/${currentOrg.key}:project/${curProjectEnv.projectKey}:env/${curProjectEnv.envKey}`,
      type: ResourceTypeEnum.Env,
    };

    const license = getCurrentLicense();
    this.isShareableSegmentGranted = license.isGranted(LicenseFeatureEnum.ShareableSegment);

    this.selectedType = SegmentType.EnvironmentSpecific;
    this.selectedScopes = [ this.currentEnvironment ];
  }

  segmentNameAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.service.isNameUsed(value as string, this.selectedType)),
    map(isNameUsed => {
      switch (isNameUsed) {
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

  private _selectedScopes: ResourceV2[] = [];
  get selectedScopes() {
    return this._selectedScopes;
  }
  set selectedScopes(scopes: ResourceV2[]) {
    this._selectedScopes = scopes;
    this.groupedSelectedScopes = groupResources(scopes);
  }
  removeScope(scope: ResourceV2) {
    this.selectedScopes = this.selectedScopes.filter(x => x.rn !== scope.rn);
  }

  get defaultSelectedScopes(): string[] {
    return this.selectedScopes.map(x => x.id);
  }

  groupedSelectedScopes: GroupedResource[] = [];
  resourceFinderVisible = false;
  openResourceFinder() {
    this.resourceFinderVisible = true;
  }
  closeResourceFinder(resources: ResourceV2[]) {
    if (resources.length > 0) {
      this.selectedScopes = resources;
    }

    this.resourceFinderVisible = false;
  }

  creating: boolean = false;
  create() {
    this.creating = true;

    const { name, description } = this.form.value;
    const type = this.selectedType;

    const currentEnvRN = this.currentEnvironment.rn;
    const scopes = this.selectedScopes
      .map(x => x.rn)
      .sort((a, b) => b.length - a.length);
    if (scopes.find(x => x !== currentEnvRN && isChildResourceOf(currentEnvRN, x)) !== undefined) {
      // remove current environment from scopes
      scopes.splice(scopes.indexOf(currentEnvRN), 1);
    }

    const payload: CreateSegment = {
      name,
      description,
      type,
      scopes
    };

    this.service.create(payload).subscribe({
      next: (segment: ISegment) => {
        this.creating = false;
        this.close(segment);
      },
      error: () => {
        this.msg.error($localize`:@@common.operation-failed:Operation failed`);
        this.creating = false;
      }
    });
  }

  close(segment: ISegment) {
    this.onClose.emit(segment);
  }

  protected readonly ResourceSpaceLevel = ResourceSpaceLevel;
  protected readonly ResourceTypeEnum = ResourceTypeEnum;
  protected readonly SegmentType = SegmentType;
}
