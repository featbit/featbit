import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { IUserType } from "@shared/types";
import { encodeURIComponentFfc, getPathPrefix } from "@utils/index";
import { Router } from "@angular/router";
import { editor } from "monaco-editor";
import { IEndUserFlag, IEndUserSegment } from "@features/safe/end-users/types/user-segments-flags";
import { EnvUserService } from "@services/env-user.service";

@Component({
  selector: 'user-segments-flags-drawer',
  templateUrl: './user-segments-flags-drawer.component.html',
  styleUrls: ['./user-segments-flags-drawer.component.less']
})
export class UserSegmentsFlagsDrawerComponent {

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

  // copy keyName
  copyText(event, text: string) {
    navigator.clipboard.writeText(text).then(
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
  flagFilter: string = '';
  flags: IEndUserFlag[] = [];
  filteredFlags: IEndUserFlag[] = [];

  loadFlags() {
    this.isFlagsLoading = true;
    this.envUserService.getFlags(this.user.id).subscribe((flags: IEndUserFlag[]) => {
      this.flags = flags;
      this.filteredFlags = flags;
      this.isFlagsLoading = false;
    });
  }

  filterFlags() {
    this.filteredFlags = this.flags.filter(x => x.key.includes(this.flagFilter) || x.name.includes(this.flagFilter));
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
