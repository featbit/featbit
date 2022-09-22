import { Component, Input, OnInit } from '@angular/core';
import { TransferChange, TransferItem } from "ng-zorro-antd/transfer";
import { SelectionModel } from '@angular/cdk/collections';
import { FlatTreeControl } from '@angular/cdk/tree';
import { NzTreeFlatDataSource, NzTreeFlattener } from 'ng-zorro-antd/tree-view';
import { NzMessageService } from "ng-zorro-antd/message";
import { SwitchTagTree, SwitchTagTreeNode } from "../types/switch-index";
import { SwitchV2Service } from "@services/switch-v2.service";

interface FlatNode {
  id: number;
  name: string;
  level: number;
  isEditing?: boolean;
}

@Component({
  selector: 'switch-tag-tree-view',
  template: `
    <div class="container">
      <div class="trees">
        <button style="margin-left: 17px" nz-button nzSize="small" nzType="text" (click)="newNode(undefined)" i18n="@@ff.add-root-node">Add root node</button>
        <nz-tree-view [nzTreeControl]="treeControl" [nzDataSource]="dataSource" [trackBy]="trackBy">
          <nz-tree-node nzTreeNodePadding *nzTreeNodeDef="let node">
            <!-- caret down or placeholder -->
            <nz-tree-node-toggle *ngIf="hasChild(node)">
              <i nz-icon nzType="down" nzTreeNodeToggleRotateIcon></i>
            </nz-tree-node-toggle>
            <nz-tree-node-toggle *ngIf="!hasChild(node)" nzTreeNodeNoopToggle>
            </nz-tree-node-toggle>

            <!-- node name -->
            <nz-tree-node-option
              [nzDisabled]="node.disabled"
              [nzSelected]="selectListSelection.isSelected(node)"
              (nzClick)="toggleNode(node)">
              <div *ngIf="node.isEditing; then editMode else showMode"></div>
              <ng-template #editMode>
                <input nz-input nzSize="small" [(ngModel)]="node.name" style="width: 120px; margin-right: 2px">
              </ng-template>
              <ng-template #showMode>
                <span>{{node.name}}</span>
              </ng-template>
            </nz-tree-node-option>

            <!-- node operations -->
            <div *ngIf="node.isEditing; then saveOperations else editOperations"></div>
            <!-- save operations -->
            <ng-template #saveOperations>
              <button nz-button nzType="text" nzSize="small"
                      i18n-nz-tooltip="@@common.save"
                      nz-tooltip="Save"
                      (click)="saveNode(node)">
                <i nz-icon nzType="save" nzTheme="outline"></i>
              </button>
            </ng-template>
            <!-- edit operations -->
            <ng-template #editOperations>
              <!-- create -->
              <button nz-button nzType="text" nzSize="small"
                      i18n-nz-tooltip="@@ff.add-child-node"
                      nz-tooltip="Add child node"
                      (click)="newNode(node)">
                <i nz-icon nzType="plus" nzTheme="outline"></i>
              </button>

              <!-- update -->
              <button nz-button nzType="text" nzSize="small"
                      (click)="editNode(node)">
                <i nz-icon nzType="edit" nzTheme="outline"></i>
              </button>
            </ng-template>

            <!-- delete operation -->
            <button nz-button nzType="text" nzSize="small" nzDanger
                    (click)="deleteNode(node)">
              <i nz-icon nzType="delete" nzTheme="outline"></i>
            </button>
          </nz-tree-node>
        </nz-tree-view>
      </div>
      <nz-transfer
        [nzDisabled]="!this.selectedNode"
        [nzDataSource]="transferItems"
        [nzShowSearch]="true"
        [nzTitles]="[unbinded, binded]"
        i18n-nzSearchPlaceholder="@@common.filter-by-name"
        nzSearchPlaceholder="Filter by name"
        [nzListStyle]="{ 'width.px': 300, 'height.px': 450 }"
        [nzRender]="render"
        (nzChange)="onTransfer($event)">
        <ng-template #render let-item>{{ item.title }}</ng-template>
      </nz-transfer>
    </div>
  `,
  styleUrls: ['./switch-tag-tree-view.component.less']
})
export class SwitchTagTreeViewComponent implements OnInit {
  binded = $localize `:@@common.binded:Binded`;
  unbinded = $localize `:@@common.unbinded:Unbinded`;

  constructor(
    private message: NzMessageService,
    private switchV2Service: SwitchV2Service,
  ) {
  }

  ngOnInit(): void {
    // init tree
    this.refreshTree();
    this.treeControl.expandAll();

    // init transfer
    this.switchV2Service.getDropDown()
      .subscribe(dropDowns => {
          this.transferItems = dropDowns.map(
            dropDown => ({
              key: dropDown.key,
              title: dropDown.value
            })
          )
        }
      );
  }

  //#region transfer

  transferItems: TransferItem[] = [];

  onTransfer(change: TransferChange) {
    const keys = change.list.map(item => item.key);
    switch (change.from) {
      case 'left':
        this.selectedNode.value = [...this.selectedNode.value, ...keys];
        break;
      case 'right':
        this.selectedNode.value = this.selectedNode.value.filter(
          key => keys.indexOf(key) === -1
        );
        break;
      default:
        break;
    }
  }

  refreshTransfer() {
    if (this.selectedNode) {
      this.transferItems = this.transferItems.map(
        item => ({
          key: item.key,
          title: item.title,
          direction: this.selectedNode.value.indexOf(item.key) !== -1
            ? 'right' : 'left'
        })
      );
    }
  }

  //#endregion

  //#region tree view

  private transformer = (node: SwitchTagTreeNode, level: number): FlatNode => {
    const existingNode = this.nestedNodeMap.get(node);
    const flatNode =
      existingNode && existingNode.id === node.id
        ? existingNode
        : {
          id: node.id,
          name: node.name,
          level: level,
          isEditing: node.isEditing
        };
    this.flatNodeMap.set(flatNode, node);
    this.nestedNodeMap.set(node, flatNode);
    return flatNode;
  };

  private _tagTree: SwitchTagTree = new SwitchTagTree([]);
  @Input()
  set tagTree(tree: SwitchTagTree) {
    if (tree) {
      this._tagTree = tree;
    }
  }

  get tagTree() {
    return this._tagTree;
  }

  flatNodeMap = new Map<FlatNode, SwitchTagTreeNode>();
  nestedNodeMap = new Map<SwitchTagTreeNode, FlatNode>();
  selectedNode: SwitchTagTreeNode;
  selectListSelection = new SelectionModel<FlatNode>(false);
  treeControl = new FlatTreeControl<FlatNode>(
    node => node.level,
    _ => true
  );
  treeFlattener = new NzTreeFlattener(
    this.transformer,
    node => node.level,
    _ => true,
    node => node.children
  );

  dataSource = new NzTreeFlatDataSource(this.treeControl, this.treeFlattener);
  trackBy = (_: number, node: FlatNode): string => `${node.id}-${node.name}`;

  hasChild(node: FlatNode) {
    const nestedNode = this.flatNodeMap.get(node);
    if (nestedNode) {
      return !!nestedNode.children && nestedNode.children.length > 0;
    }

    return false;
  }

  toggleNode(node: FlatNode) {
    this.selectedNode = this.selectListSelection.isSelected(node)
      ? null
      : this.flatNodeMap.get(node);
    this.selectListSelection.toggle(node);

    this.refreshTransfer();
  }

  newNode(node: FlatNode): void {
    let parentNode: SwitchTagTreeNode = undefined;
    if (node) {
      parentNode = this.flatNodeMap.get(node);
      this.treeControl.expand(node);
    }

    const newNode = {
      id: this.tagTree.getNewId(),
      name: '',
      value: [],
      children: [],
      isEditing: true
    };

    const insertedNode = this.tagTree.insertNode(newNode, parentNode);
    insertedNode.isEditing = true;
    this.refreshTree();
  }

  editNode(node: FlatNode): void {
    node.isEditing = true;
  }

  saveNode(node: FlatNode): void {
    if (node.name.trim() === '') {
      this.message.warning($localize `:@@ff.node-name-cannot-be-empty:Node name cannot be empty`);
      return;
    }

    node.isEditing = false;
    const nestedNode = this.flatNodeMap.get(node);
    if (nestedNode) {
      nestedNode.isEditing = false;
      this.tagTree.updateNode(nestedNode, node.name);
      this.refreshTree();
    }
  }

  deleteNode(node: FlatNode): void {
    const treeNode = this.flatNodeMap.get(node);
    this.tagTree.deleteNode(treeNode);
    this.refreshTree();
  }

  refreshTree() {
    this.dataSource.setData(this.tagTree.trees);
  }

  //#endregion
}
