import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IUserType } from "@shared/types";
import { encodeURIComponentFfc, getPathPrefix, copyToClipboard } from "@utils/index";
import { Router } from "@angular/router";
import { editor } from "monaco-editor";
import {
  EndUserFlagFilter,
  IEndUserFlag,
  IEndUserSegment,
  IPagedEndUserFlag
} from "@features/safe/end-users/types/user-segments-flags";
import { EnvUserService } from "@services/env-user.service";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";

@Component({
  selector: 'user-segments-flags-drawer',
  templateUrl: './user-segments-flags-drawer.component.html',
  styleUrls: ['./user-segments-flags-drawer.component.less']
})
export class UserSegmentsFlagsDrawerComponent implements OnInit {

  private _user: IUserType;
  @Input()
  set user(value: IUserType) {
    if (!value) {
      return;
    }

    this._user = value;
    this.loadFlags();
    this.loadSegments();
  }

  get user() {
    return this._user;
  }

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<boolean> = new EventEmitter();

  constructor(
    private router: Router,
    private envUserService: EnvUserService,
    private message: NzMessageService
  ) { }

  ngOnInit(): void {
    this.$searchFlags.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.loadFlags();
    });
  }

  // copy keyName
  copyText(event, text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }

  /******************** editor start *******************************/

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

  variation: string = '';
  variationType: string = 'string';
  optionValueExpandVisible = false;

  expandVariationOption(variation: string, variationType: string) {
    this.variation = variation;
    this.variationType = variationType;
    this.optionValueExpandVisible = true;
  }

  /******************** editor end *******************************/

  /******************** flags start *******************************/

  isFlagsLoading: boolean = false;
  flagFilter: EndUserFlagFilter = new EndUserFlagFilter();
  flags: IPagedEndUserFlag = {
    totalCount: 0,
    items: []
  };

  $searchFlags: Subject<void> = new Subject();
  doSearchFlags(resetPage?: boolean) {
    if (resetPage) {
      this.flagFilter.pageIndex = 1;
    }

    this.$searchFlags.next();
  }

  loadFlags() {
    this.isFlagsLoading = true;
    this.envUserService.getFlags(this.user.id, this.flagFilter).subscribe(flags => {
      this.flags = flags;
      this.isFlagsLoading = false;
    });
  }

  getMatchVariationDisplayOrder(flag: IEndUserFlag) {
    return flag.variations.findIndex(x => x.value === flag.matchVariation);
  }

  /******************** flags end ********************************/

  /******************* segments start *****************************/
  isSegmentsLoading: boolean = false;
  segmentFilter: string = '';
  segments: IEndUserSegment[] = [];
  filteredSegments: IEndUserSegment[] = [];

  loadSegments() {
    this.isSegmentsLoading = true;
    this.envUserService.getSegments(this.user.id).subscribe((segments: IEndUserSegment[]) => {
      this.segments = segments;
      this.filteredSegments = segments;
      this.isSegmentsLoading = false;
    });
  }

  filterSegments() {
    this.filteredSegments = this.segments.filter(x => x.name.includes(this.segmentFilter));
  }

  /******************* segments end *****************************/

  public navigateToSegment(id: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`${getPathPrefix()}segments/details/${encodeURIComponentFfc(id)}/targeting`])
    );

    window.open(url, '_blank');
  }

  public navigateToFlag(key: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`${getPathPrefix()}feature-flags/${encodeURIComponentFfc(key)}/targeting`])
    );

    window.open(url, '_blank');
  }
}
