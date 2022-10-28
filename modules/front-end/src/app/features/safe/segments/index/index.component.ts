import {Component, Inject, LOCALE_ID, OnDestroy, OnInit} from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import {encodeURIComponentFfc, hasLocalePath} from '@shared/utils';
import { SegmentListFilter, ISegment, ISegmentListModel, ISegmentFlagReference } from "../types/segments-index";
import { SegmentService } from "@services/segment.service";
import { debounceTime, first, map, switchMap } from 'rxjs/operators';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import {CURRENT_LANGUAGE} from "@utils/localstorage-keys";

@Component({
  selector: 'segments-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit, OnDestroy {

  private destory$: Subject<void> = new Subject();

  public createModalVisible: boolean = false;
  public isOkLoading: boolean = false;
  public segmentName: string = '';
  public isIntoing: boolean = false;

  public deleteModalVisible: boolean = false;
  public currentDeletingSegment: ISegment;
  public currentDeletingSegmentFlagReferences: ISegmentFlagReference[] = [];

  deleteValidation(segment: ISegment) {
    this.currentDeletingSegment = segment;
    this.currentDeletingSegmentFlagReferences = [];
    this.segmentService.getFeatureFlagReferences(segment.id).subscribe((flags: ISegmentFlagReference[]) => {
      this.currentDeletingSegmentFlagReferences = [...flags];
      this.deleteModalVisible = true;
    });

    // TODO remove this line
    this.deleteModalVisible = true;
  }

  closeDeleteModal() {
    this.deleteModalVisible = false;
  }

  deleting: boolean = false;
  delete(id: string) {
    this.deleting = true;
    this.segmentService.archive(id).subscribe(() => {
      this.segmentListModel.items = this.segmentListModel.items.filter(it => it.id !== id);
      this.segmentListModel.totalCount--;
      this.deleting = false;
      this.closeDeleteModal();
    }, () => {
      this.deleting = false;
      this.closeDeleteModal();
    });
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

  segmentNameValidator = (control: FormControl) => {
    const name = control.value;
    if (!name) {
      return {error: true, required: true};
    }

    if (name.includes('__')) {
      return {error: true, invalid_character: true};
    }
  }

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
    this.segmentService.create(name, description)
      .subscribe((result: ISegment) => {
        this.segmentService.setCurrent(result);
        this.toRouter(result.id);
        this.creating = false;
      }, err => {
        this.msg.error(err.error);
        this.creating = false;
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
    @Inject(LOCALE_ID) public activeLocale: string,
    private router: Router,
    private segmentService: SegmentService,
    private msg: NzMessageService,
    private fb: FormBuilder,
  ) {
    this.segmentForm = this.fb.group({
      name: ['', [this.segmentNameValidator], [this.segmentNameAsyncValidator], 'change'],
      keyName: [{value: '', disabled: true}, [Validators.required]],
      description: [null]
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

  public onIntoSegmentDetail(data: ISegment) {
    if(this.isIntoing) return;
    this.isIntoing = true;
    this.segmentService.setCurrent(data);
    this.toRouter(data.id);
  }

  private toRouter(id: string) {
    this.router.navigateByUrl(`/segments/details/${encodeURIComponentFfc(id)}/targeting`);
  }

  public openFlagPage(flagKey: string) {
    const path = hasLocalePath()? `/${this.activeLocale}/feature-flags/${flagKey}/targeting` : `/feature-flags/${flagKey}/targeting`;
    const url = this.router.serializeUrl(
      this.router.createUrlTree([path])
    );

    window.open(url, '_blank');
  }

  getLocalDate(date: string) {
    if (!date) return '';
    return new Date(date);
  }
}
