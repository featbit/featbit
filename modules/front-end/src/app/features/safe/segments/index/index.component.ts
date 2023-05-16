import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { encodeURIComponentFfc, getPathPrefix } from '@shared/utils';
import { SegmentListFilter, ISegment, ISegmentListModel, ISegmentFlagReference } from "../types/segments-index";
import { SegmentService } from "@services/segment.service";
import { debounceTime, first, map, switchMap } from 'rxjs/operators';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";

@Component({
  selector: 'segments-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit, OnDestroy {

  private destory$: Subject<void> = new Subject();

  createModalVisible: boolean = false;
  isIntoing: boolean = false;
  isDelete: boolean = false; // to differencing delete and archive
  deleteArchiveModalVisible: boolean = false;

  currentDeletingArchivingSegment: ISegment;
  currentDeletingArchivingSegmentFlagReferences: ISegmentFlagReference[] = [];

  deleteArchiveValidation(segment: ISegment, isDelete: boolean) {
    this.isDelete = isDelete;
    this.currentDeletingArchivingSegment = segment;
    this.currentDeletingArchivingSegmentFlagReferences = [];
    this.segmentService.getFeatureFlagReferences(segment.id).subscribe((flags: ISegmentFlagReference[]) => {
      this.currentDeletingArchivingSegmentFlagReferences = [...flags];
      this.deleteArchiveModalVisible = true;
    });
  }

  restore(segment: ISegment) {
    this.segmentService.restore(segment.id).subscribe({
      next: () => {
        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        this.onSearch();
      },
      error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }

  closeDeleteArchiveModal() {
    this.deleteArchiveModalVisible = false;
  }

  deletingOrArchiving: boolean = false;
  deleteArchive(id: string) {
    this.deletingOrArchiving = true;

    if (this.isDelete) {
      this.segmentService.delete(id).subscribe({
        next: () => {
          this.segmentListModel.items = this.segmentListModel.items.filter(it => it.id !== id);
          this.segmentListModel.totalCount--;
          this.deletingOrArchiving = false;
          this.closeDeleteArchiveModal();
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => {
          this.deletingOrArchiving = false;
          this.closeDeleteArchiveModal();
        }
      });
    } else { // archiving
      this.segmentService.archive(id).subscribe({
        next: () => {
          this.deletingOrArchiving = false;
          this.onSearch();
          this.closeDeleteArchiveModal();
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => {
          this.msg.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
          this.deletingOrArchiving = false;
          this.closeDeleteArchiveModal();
        }
      });
    }
  }

  segmentListModel: ISegmentListModel = {
    items: [],
    totalCount: 0
  };

  loading: boolean = true;

  loadSegmentList() {
    this.loading = true;
    this.segmentService
      .getSegmentList(this.segmentFilter)
      .subscribe((segments: ISegmentListModel) => {
        this.segmentListModel = segments;
        this.loading = false;
      });
  }

  segmentFilter: SegmentListFilter = new SegmentListFilter();

  $search: Subject<void> = new Subject();

  onSearch(resetPage?: boolean) {
    this.loading = true;
    this.segmentListModel = {
      items: [],
      totalCount: 0
    };

    if (resetPage) {
      this.segmentFilter.pageIndex = 1;
    }
    this.$search.next();
  }

  subscribeSearch() {
    this.$search.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.loadSegmentList();
    });
  }

  segmentForm: FormGroup;

  segmentNameAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.segmentService.isNameUsed(value as string)),
    map(isNameUsed => {
      switch (isNameUsed) {
        case true:
          return {error: true, duplicated: true};
        case undefined:
          return {error: true, unknown: true};
        default:
          return null;
      }
    }),
    first()
  );

  creating: boolean = false;

  createSegment() {
    this.creating = true;

    const { name, description } = this.segmentForm.value;
    this.segmentService.create(name, description).subscribe({
      next: (segment: ISegment) => {
        this.toRouter(segment.id);
        this.creating = false;
      },
      error: () => {
        this.msg.error($localize `:@@common.operation-failed:Operation failed`);
        this.creating = false;
      }
    });
  }

  closeCreateModal() {
    this.createModalVisible = false;
    this.segmentForm.reset({
      name: '',
      description: ''
    });
  }

  //#endregion
  constructor(
    private router: Router,
    private segmentService: SegmentService,
    private msg: NzMessageService,
    private fb: FormBuilder,
  ) {
    this.segmentForm = this.fb.group({
      name: ['', Validators.required, this.segmentNameAsyncValidator],
      description: ['']
    });
  }

  ngOnInit(): void {
    this.subscribeSearch();
    this.$search.next();
  }

  addSegment() {
    this.createModalVisible = true;
  }

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }

  onIntoSegmentDetail(data: ISegment) {
    if(this.isIntoing) return;
    this.isIntoing = true;
    this.toRouter(data.id);
  }

  private toRouter(id: string) {
    this.router.navigateByUrl(`/segments/details/${encodeURIComponentFfc(id)}/targeting`);
  }

  openFlagPage(flagKey: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/${getPathPrefix()}feature-flags/${flagKey}/targeting`])
    );

    window.open(url, '_blank');
  }

  getLocalDate(date: string) {
    if (!date) return '';
    return new Date(date);
  }
}
