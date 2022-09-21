import {Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import {IUserType} from "@shared/types";
import {encodeURIComponentFfc} from "@utils/index";
import { EnvUserPropService } from "@services/env-user-prop.service";
import {ISegment, ISegmentListModel, SegmentListFilter} from "@features/safe/segments/types/segments-index";
import {SegmentService} from "@services/segment.service";
import {Subject} from "rxjs";
import {debounceTime} from "rxjs/operators";
import {Router} from "@angular/router";
import {SwitchListFilter, SwitchListModel} from "@features/safe/switch-manage/types/switch-index";
import {SwitchV2Service} from "@services/switch-v2.service";
import {IFfParams, IVariationOption} from "@features/safe/switch-manage/types/switch-new";
import {editor} from "monaco-editor";

@Component({
  selector: 'user-segments-flags-drawer',
  templateUrl: './user-segments-flags-drawer.component.html',
  styleUrls: ['./user-segments-flags-drawer.component.less']
})
export class UserSegmentsFlagsDrawerComponent implements OnInit {

  @Input() envId: number;
  @Input() user: IUserType;
  @Output() close: EventEmitter<boolean> = new EventEmitter();

  constructor(
    private router: Router,
    private switchV2Service: SwitchV2Service,
    private segmentService: SegmentService,
    private envUserPropService: EnvUserPropService,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    this.subscribeSegmentsSearch();
    this.subscribeFlagsSearch();
  }

  // copy keyName
  copyText(event, text: string) {
    navigator.clipboard.writeText(text).then(
      () => this.message.success($localize `:@@common.copy-success:Copied`)
    );
  }

  /******************** flags start *******************************/
  editor?: editor.ICodeEditor | editor.IEditor;
  formatCode(e?: editor.ICodeEditor | editor.IEditor) {
    if (e) {
      this.editor = e;
    }

    // @ts-ignore
    setTimeout(async () => {
      this.editor.updateOptions({readOnly: false});
      await this.editor.getSupportedActions().find(act => act.id === 'editor.action.formatDocument')?.run();
      this.editor.updateOptions({readOnly: true});
    }, 100);
  }

  currentVariationOption: IVariationOption = null;
  currentVariationDataType: string = null;
  optionValueExpandVisible = false;
  expandVariationOption(v: IVariationOption, variationDataType: string) {
    this.currentVariationOption = {...v};
    this.currentVariationDataType = variationDataType;
    this.optionValueExpandVisible = true;
  }

  isFlagsLoading: boolean = false;
  flagFilter: SwitchListFilter = new SwitchListFilter();
  $searchFlags: Subject<void> = new Subject();

  onSearchFlags() {
    this.flagFilter.pageIndex = 1;

    this.$searchFlags.next();
  }

  subscribeFlagsSearch() {
    this.$searchFlags.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.loadFlagList();
    });
  }

  flagListModel: SwitchListModel = {
    items: [],
    totalCount: 0
  };

  loadFlagList() {
    this.flagFilter.userKeyId = this.user?.keyId;
    this.isFlagsLoading = true;

    this.switchV2Service
      .getListForUser(this.flagFilter)
      .subscribe((flags: SwitchListModel) => {
        this.flagListModel = flags;
        this.isFlagsLoading = false;
      });
  }

  /******************** flags end ********************************/

  /******************* segments start *****************************/
  isSegmentsLoading: boolean = false;
  segmentFilter: SegmentListFilter = new SegmentListFilter();
  $searchSegments: Subject<void> = new Subject();

  onSearchSegments() {
    this.segmentFilter.pageIndex = 1;

    this.$searchSegments.next();
  }

  subscribeSegmentsSearch() {
    this.$searchSegments.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.loadSegmentList();
    });
  }

  segmentListModel: ISegmentListModel = {
    items: [],
    totalCount: 0
  };

  loadSegmentList() {
    this.segmentFilter.pageSize = 5000; // set a big enough value to get all segments
    this.segmentFilter.userKeyId = this.user?.keyId;
    this.isSegmentsLoading = true;
    this.segmentService
      .getSegmentListForUser(this.segmentFilter)
      .subscribe((segments: ISegmentListModel) => {
        this.segmentListModel = segments;
        this.isSegmentsLoading = false;
      });
  }
  /******************* segments end *****************************/
  private _visible: boolean = false;
  @Input()
  set visible(visible: boolean) {
    if (visible) {
      this.segmentListModel = {
        items: [],
        totalCount: 0
      };
      this.segmentFilter = new SegmentListFilter();
      this.$searchSegments.next();

      this.flagListModel = {
        items: [],
        totalCount: 0
      };
      this.flagFilter = new SwitchListFilter();
      this.$searchFlags.next();
    }
    this._visible = visible;
  }
  get visible() {
    return this._visible;
  }

  // 转换本地时间
  getLocalDate(date: string) {
    if (!date) return '';
    return new Date(date);
  }

  // 点击进入对应开关详情
  public onIntoSegmentDetail(data: ISegment) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/segments/details/${encodeURIComponentFfc(data.id)}/targeting`])
    );

    window.open(url, '_blank');
  }

  // 点击进入对应开关详情
  public onIntoFlagDetail(data: IFfParams) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/switch-manage/${encodeURIComponentFfc(data.id)}/targeting`])
    );

    window.open(url, '_blank');
  }
}
