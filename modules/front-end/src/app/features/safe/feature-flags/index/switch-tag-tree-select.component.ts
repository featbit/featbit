import { Component, Input, Output, EventEmitter } from '@angular/core';
import { NzTreeNodeOptions } from "ng-zorro-antd/core/tree/nz-tree-base-node";
import { SwitchTagTree } from "../types/switch-index";

@Component({
  selector: 'switch-tag-tree-select',
  template: `
    <nz-tree-select
      class="tag-select"
      nzPlaceHolder="按标签筛选"
      [(ngModel)]="selectedTagIds"
      [nzNodes]="options"
      [nzMaxTagCount]="1"
      [nzMaxTagPlaceholder]="omittedPlaceHolder"
      nzShowSearch
      nzCheckable
      nzAllowClear
      (ngModelChange)="onSelect.emit(selectedTagIds)"
    ></nz-tree-select>
    <ng-template #omittedPlaceHolder let-omittedValues>等共 {{ omittedValues.length + 1 }} 个</ng-template>
  `,
  styleUrls: ['./switch-tag-tree-select.component.less']
})
export class SwitchTagTreeSelectComponent {
  options: NzTreeNodeOptions[] = [];
  selectedTagIds: number[];

  @Input()
  set tagTree(tree: SwitchTagTree) {
    if (tree) {
      this.options = tree.toTreeSelectNodes();
    }
  }

  @Output()
  onSelect = new EventEmitter<number[]>();
}
