import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { debounceTime, first, map, switchMap } from "rxjs/operators";
import { SegmentService } from "@services/segment.service";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'segment-creation-modal',
  templateUrl: './segment-creation-modal.component.html',
  styleUrls: [ './segment-creation-modal.component.less' ]
})
export class SegmentCreationModalComponent {
  @Input()
  isVisible: boolean = false;

  @Output()
  onClose: EventEmitter<ISegment> = new EventEmitter<ISegment>();

  form: FormGroup;

  types = [
    { label: 'Environment Specific', value: 'List' },
    { label: 'Shareable', value: 'Kanban' }
  ];

  onCancel() {
    this.onClose.emit(null);
  }

  constructor(
    private fb: FormBuilder,
    private service: SegmentService,
    private msg: NzMessageService
  ) {
    this.form = this.fb.group({
      name: [ '', Validators.required, this.segmentNameAsyncValidator ],
      description: [ '' ]
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
}
