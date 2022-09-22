import { NzTreeNodeOptions } from "ng-zorro-antd/core/tree/nz-tree-base-node";
import { CSwitchParams, IVariationOption } from "@features/safe/feature-flags/types/switch-new";

export interface SwitchListModel {
  items: SwitchListItem[];
  totalCount: number;
}

export interface SwitchListItem {
  id: string;
  name: string;
  keyName: string;
  tags: string[];
  status: string;
  lastModificationTime: Date;
  variationOverview: VariationOverview,
  variation: IVariationOption,
  variationDataType: string
}

export interface VariationOverview {
  variationWhenOff: IVariationOption,
  variationsWhenOn: IVariationOption[],
  variationsWhenOnStr: string[]
}

export interface SwitchListCheckItem {
  id: string;
  name: string;
  checked: boolean;
}

export interface CopyToEnvResult {
  copiedCount: number;
  ignored: string[];
}

export class SwitchListFilter {
  name?: string;
  userKeyId?: string;
  status?: string;
  tagIds?: number[];
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    userKeyId?: string,
    status?: string,
    tagIds?: number[],
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.name = name ?? '';
    this.userKeyId = userKeyId ?? '';
    this.status = status ?? '';
    this.tagIds = tagIds ?? [];
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface SwitchTagTreeNode {
  id: number;
  name: string;
  value: string[];
  children: SwitchTagTreeNode[];
  isEditing?: boolean;
}

export interface SwitchDropdown {
  key: string;
  value: string;
}

export interface SwitchDetail {
  featureFlag: CSwitchParams;
  tags: string[];
}

export interface UpdateSettingPayload {
  name: string;
  status: string;
  variationOptionWhenDisabled: IVariationOption;
  variationOptions: IVariationOption[];
  variationDataType: string;
}

export class SwitchTagTree {
  trees: SwitchTagTreeNode[];
  private _maxNodeId: number;

  constructor(nodes: SwitchTagTreeNode[]) {
    this.trees = nodes;
    this._maxNodeId = this.getTreesMaxNodeId();
  }

  toTreeSelectNodes(): NzTreeNodeOptions[] {
    const options = [];
    for (const node of this.trees) {
      let option = this.tagTreeNodeOption(node);
      options.push(option);
    }

    return options;
  }

  tagTreeNodeOption(node: SwitchTagTreeNode): NzTreeNodeOptions {
    return {
      key: node.id.toString(),
      title: node.name,
      isLeaf: node.children.length === 0,
      children: node.children.map(child => this.tagTreeNodeOption(child))
    };
  }

  getTreesMaxNodeId(): number {
    let maxNodeId = 0;
    for (const tree of this.trees) {
      maxNodeId = this.getTreeMaxNodeId(tree, maxNodeId);
    }
    return maxNodeId;
  }

  getTreeMaxNodeId(node: SwitchTagTreeNode, maxNodeId: number): number {
    if (node.id > maxNodeId) {
      maxNodeId = node.id;
    }

    for (const child of node.children) {
      maxNodeId = this.getTreeMaxNodeId(child, maxNodeId);
    }

    return maxNodeId;
  }

  getNewId(): number {
    return ++this._maxNodeId;
  }

  length(): number {
    return this.trees.length;
  }

  parentNode(childNode: SwitchTagTreeNode): SwitchTagTreeNode | null {
    const stack = [...this.trees];
    while (stack.length > 0) {
      const node = stack.pop()!;
      if (node.children) {
        if (node.children.find(e => e === childNode)) {
          return node;
        }

        for (let i = node.children.length - 1; i >= 0; i--) {
          stack.push(node.children[i]);
        }
      }
    }

    return null;
  };

  createNode(name: string, parentNode: SwitchTagTreeNode): SwitchTagTreeNode {
    const node = {
      id: this.getNewId(),
      name: name,
      value: [],
      children: []
    };

    this.insertNode(node, parentNode);

    return node;
  }

  insertNode(node: SwitchTagTreeNode, parentNode: SwitchTagTreeNode): SwitchTagTreeNode {
    // insert child node
    if (parentNode) {
      parentNode.children = parentNode.children || [];
      parentNode.children.push(node);
    }
    // insert root node
    else {
      this.trees = [...this.trees, node];
    }

    return node;
  }

  updateNode(node: SwitchTagTreeNode, newName: string) {
    node.name = newName;
    if (node.id === -1) {
      node.id = this.getNewId();
    }
  }

  deleteNode(node: SwitchTagTreeNode) {
    const parentNode = this.parentNode(node);
    if (parentNode && parentNode.children) {
      // delete child node
      parentNode.children = parentNode.children.filter(child => child !== node);
    } else {
      // delete root node
      this.trees = this.trees.filter(root => root !== node);
    }
  }

  getSwitchTags(theSwitchId: string): string[] {
    let tags = [];

    for (const tree of this.trees) {
      this.getSwitchTagsRecursive(tree, theSwitchId, tags);
    }

    return tags;
  }

  getSwitchTagsRecursive(node: SwitchTagTreeNode, theSwitchId: string, tags: string[]) {
    if (node.value && node.value.find(switchId => switchId === theSwitchId)) {
      tags.push(node.name);
    }

    for (const child of node.children) {
      this.getSwitchTagsRecursive(child, theSwitchId, tags);
    }
  }
}
