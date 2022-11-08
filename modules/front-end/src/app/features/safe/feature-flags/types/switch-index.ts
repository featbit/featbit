import { NzTreeNodeOptions } from "ng-zorro-antd/core/tree/nz-tree-base-node";
import {FeatureFlagParams} from "@features/safe/feature-flags/types/switch-new";

export interface IFeatureFlagListModel {
  items: IFeatureFlagListItem[];
  totalCount: number;
}

export interface IFeatureFlagListItem {
  id: string;
  name: string;
  key: string;
  tags: string[];
  isEnabled: boolean;
  updatedAt: Date;
  variationType: string;
  serves: IVariationOverview,
}

export interface IVariationOverview {
  disabledVariation: string,
  enabledVariations: string[],
}

export interface IFeatureFlagListCheckItem {
  id: string;
  name: string;
  checked: boolean;
}

export interface ICopyToEnvResult {
  copiedCount: number;
  ignored: string[];
}

export class IFeatureFlagListFilter {
  name?: string;
  userKeyId?: string;
  isEnabled?: boolean;
  tags?: string[];
  isArchived?: boolean;
  pageIndex: number;
  pageSize: number;

  constructor(
    name?: string,
    userKeyId?: string,
    isEnabled?: boolean,
    tags?: string[],
    archivedOnly?: boolean,
    pageIndex: number = 1,
    pageSize: number = 10) {
    this.name = name ?? '';
    this.userKeyId = userKeyId ?? '';
    this.isEnabled = isEnabled;
    this.tags = tags ?? [];
    this.isArchived = !!archivedOnly;
    this.pageIndex = pageIndex;
    this.pageSize = pageSize;
  }
}

export interface IFeatureFlagTagTreeNode {
  id: number;
  name: string;
  value: string[];
  children: IFeatureFlagTagTreeNode[];
  isEditing?: boolean;
}

export interface IFeatureFlagDropdown {
  key: string;
  value: string;
}

export interface IFeatureFlagDetail {
  featureFlag: FeatureFlagParams;
  tags: string[];
}

export class FeatureFlagTagTree {
  trees: IFeatureFlagTagTreeNode[];
  private _maxNodeId: number;

  constructor(nodes: IFeatureFlagTagTreeNode[]) {
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

  tagTreeNodeOption(node: IFeatureFlagTagTreeNode): NzTreeNodeOptions {
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

  getTreeMaxNodeId(node: IFeatureFlagTagTreeNode, maxNodeId: number): number {
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

  parentNode(childNode: IFeatureFlagTagTreeNode): IFeatureFlagTagTreeNode | null {
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

  createNode(name: string, parentNode: IFeatureFlagTagTreeNode): IFeatureFlagTagTreeNode {
    const node = {
      id: this.getNewId(),
      name: name,
      value: [],
      children: []
    };

    this.insertNode(node, parentNode);

    return node;
  }

  insertNode(node: IFeatureFlagTagTreeNode, parentNode: IFeatureFlagTagTreeNode): IFeatureFlagTagTreeNode {
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

  updateNode(node: IFeatureFlagTagTreeNode, newName: string) {
    node.name = newName;
    if (node.id === -1) {
      node.id = this.getNewId();
    }
  }

  deleteNode(node: IFeatureFlagTagTreeNode) {
    const parentNode = this.parentNode(node);
    if (parentNode && parentNode.children) {
      // delete child node
      parentNode.children = parentNode.children.filter(child => child !== node);
    } else {
      // delete root node
      this.trees = this.trees.filter(root => root !== node);
    }
  }

  getFeatureFlagTags(theSwitchId: string): string[] {
    let tags = [];

    for (const tree of this.trees) {
      this.getFeatureFlagTagsRecursive(tree, theSwitchId, tags);
    }

    return tags;
  }

  getFeatureFlagTagsRecursive(node: IFeatureFlagTagTreeNode, theSwitchId: string, tags: string[]) {
    if (node.value && node.value.find(switchId => switchId === theSwitchId)) {
      tags.push(node.name);
    }

    for (const child of node.children) {
      this.getFeatureFlagTagsRecursive(child, theSwitchId, tags);
    }
  }
}
