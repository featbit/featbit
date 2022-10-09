import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NzTreeNodeOptions } from "ng-zorro-antd/core/tree/nz-tree-base-node";
import { FeatureFlagTagTree } from "../types/switch-index";

@Component({
  selector: 'switch-tag-tree-select',
  template: `
    <nz-tree-select
      class="tag-select"
      i18n-nzPlaceHolder="@@ff.idx.filter-by-tags"
      nzPlaceHolder="Filter by tags"
      [(ngModel)]="selectedTagIds"
      [nzNodes]="options"
      [nzMaxTagCount]="1"
      [nzMaxTagPlaceholder]="omittedPlaceHolder"
      nzShowSearch
      nzCheckable
      nzAllowClear
      (ngModelChange)="onSelect.emit(selectedTagIds)"
    ></nz-tree-select>
    <ng-template #omittedPlaceHolder let-omittedValues><ng-container i18n="@@common.etc">+</ng-container> {{ omittedValues.length }} <ng-container i18n="@@common.entries">more</ng-container></ng-template>
  `,
  styleUrls: ['./switch-tag-tree-select.component.less']
})
export class SwitchTagTreeSelectComponent {
  options: NzTreeNodeOptions[] = [];
  selectedTagIds: number[];

  @Input()
  set tagTree(tree: FeatureFlagTagTree) {
    if (tree) {
      this.options = tree.toTreeSelectNodes();
    }
  }

  @Output()
  onSelect = new EventEmitter<number[]>();
}
