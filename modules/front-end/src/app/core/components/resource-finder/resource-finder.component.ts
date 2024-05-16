import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import {
  GroupedResource,
  groupResources,
  ResourceFilterV2,
  ResourceSpaceLevel,
  ResourceTypeEnum,
  ResourceV2
} from "@shared/policy";
import { ResourceService } from "@services/resource.service";
import { debounceTime } from "rxjs/operators";
import { Subject } from "rxjs";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'resource-finder',
  templateUrl: './resource-finder.component.html',
  styleUrls: ['./resource-finder.component.less']
})
export class ResourceFinderComponent implements OnInit {
  private _isVisible: boolean = false;
  get isVisible() {
    return this._isVisible;
  }
  @Input()
  set isVisible(visible: boolean) {
    this._isVisible = visible;
    if (visible) {
      this.selectedItems = this.defaultSelected.map(x => x);
    }
  }
  @Input()
  resources: ResourceTypeEnum[] = [ResourceTypeEnum.Project, ResourceTypeEnum.Env, ResourceTypeEnum.Flag, ResourceTypeEnum.Segment];
  @Input()
  spaceLevel: ResourceSpaceLevel = ResourceSpaceLevel.Organization;
  @Input()
  defaultSelected: ResourceV2[] = [];
  @Input()
  unremovableRn: string = '';
  @Output()
  onClose: EventEmitter<ResourceV2[]> = new EventEmitter<ResourceV2[]>();

  constructor(
    private msg: NzMessageService,
    private resourceService: ResourceService
  ) { }

  private _items: ResourceV2[] = [];
  get items() {
    return this._items;
  }
  set items(items: ResourceV2[]) {
    this._items = items;
    this.groupedItems = groupResources(items);
  }

  groupedItems: GroupedResource[] = [];
  $search = new Subject<void>();
  isLoading = true;
  filter: ResourceFilterV2 = {
    name: '',
    spaceLevel: ResourceSpaceLevel.Organization,
    types: []
  };

  ngOnInit(): void {
    this.filter.types = this.resources;
    this.filter.spaceLevel = this.spaceLevel;

    this.$search.pipe(
      debounceTime(200)
    ).subscribe(() => {
      this.fetchResources();
    });
    this.$search.next();
  }

  onSearch() {
    this.$search.next();
  }

  selectedItems: ResourceV2[] = [];

  toggleSelected(item: ResourceV2) {
    let existedItem = this.selectedItems.find(x => x.rn === item.rn);
    if (existedItem) {
      this.removeFromSelected(existedItem);
    } else {
      this.addToSelected(item);
    }
  }

  addToSelected(item: ResourceV2) {
    this.selectedItems.push(item);
  }

  removeFromSelected(item: ResourceV2) {
    if (item.rn === this.unremovableRn) {
      this.msg.warning($localize`:@@common.unremovable-item:This item cannot be unselected.`);
      return;
    }

    this.selectedItems = this.selectedItems.filter(x => x.rn !== item.rn);
  }

  isSelected(item: ResourceV2) {
    return this.selectedItems.find(x => x.rn === item.rn) !== undefined;
  }

  onCancel() {
    this.selectedItems = [];
    this.onClose.emit([]);
  }

  onOk() {
    let snapshot = this.selectedItems.map(x => x);
    this.selectedItems = [];
    this.onClose.emit(snapshot);
  }

  private fetchResources() {
    this.isLoading = true;
    this.resourceService.getResourcesV2(this.filter).subscribe(resources => {
      // filter out general resources
      this.items = resources.filter(x => !x.rn.includes('*'));
      this.isLoading = false;
    });
  }
}
