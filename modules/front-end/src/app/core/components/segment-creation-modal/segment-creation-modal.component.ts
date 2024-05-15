import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { SegmentService } from "@services/segment.service";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { NzMessageService } from "ng-zorro-antd/message";
import { ResourceSpaceLevel, ResourceTypeEnum } from "@shared/policy";

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
      this.initForm();
    }
  }

  @Output()
  onClose: EventEmitter<ISegment> = new EventEmitter<ISegment>();

  form: FormGroup<{
    name: FormControl<string>,
    description: FormControl<string>
  }>;

  type: number = 0;
  types: string[] = [ 'Environment Specific', 'Shareable' ];

  constructor(
    private fb: FormBuilder,
    private service: SegmentService,
    private msg: NzMessageService
  ) {
    this.initForm();
  }

  initForm() {
    this.form = new FormGroup({
      name: new FormControl('', [ Validators.required ], [ this.segmentNameAsyncValidator ]),
      description: new FormControl('')
    });
  }

  segmentNameAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.service.isNameUsed(value as string)),
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

  selectedScopes: string[] = [];
  resourceFinderVisible = false;
  openResourceFinder() {
    this.resourceFinderVisible = true;
  }
  closeResourceFinder(scopes: string[]) {
    if (scopes.length > 0) {
      this.selectedScopes = scopes;
    }

    this.resourceFinderVisible = false;
  }
  removeScope(scope: string) {
    this.selectedScopes = this.selectedScopes.filter(x => x !== scope);
  }

  creating: boolean = false;
  create() {
    this.creating = true;

    const { name, description } = this.form.value;
    this.service.create(name, description).subscribe({
      next: (segment: ISegment) => {
        this.creating = false;
        this.onClose.emit(segment);
      },
      error: () => {
        this.msg.error($localize`:@@common.operation-failed:Operation failed`);
        this.creating = false;
        this.onClose.emit(null);
      }
    });
  }

  onCancel() {
    this.onClose.emit(null);
  }

  protected readonly ResourceSpaceLevel = ResourceSpaceLevel;
  protected readonly ResourceTypeEnum = ResourceTypeEnum;
}
