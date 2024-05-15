import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ResourceFilterV2, ResourceSpaceLevel, ResourceTypeEnum, ResourceV2 } from "@shared/policy";
import { ResourceService } from "@services/resource.service";
import { debounceTime } from "rxjs/operators";
import { Subject } from "rxjs";

interface GroupedItem {
  name: string;
  items: ResourceV2[];
}

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
  @Output()
  onClose: EventEmitter<ResourceV2[]> = new EventEmitter<ResourceV2[]>();

  constructor(private resourceService: ResourceService) {
  }

  groupedItems: GroupedItem[] = [];
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
    this.groupedItems = [];
    this.isLoading = true;
    this.resourceService.getResourcesV2(this.filter).subscribe(resources => {
      for (const resource of resources) {
        const type = this.mapResourceType(resource.type);
        const group = this.groupedItems.find(x => x.name === type);
        if (group) {
          group.items.push(resource);
        } else {
          this.groupedItems.push({
            name: type,
            items: [resource]
          });
        }
      }

      this.isLoading = false;
    });
  }

  private mapResourceType(type: ResourceTypeEnum): string {
    switch (type) {
      case ResourceTypeEnum.organization:
        return $localize`:@@common.organization:Organization`;
      case ResourceTypeEnum.Project:
        return $localize`:@@common.project:Project`;
      case ResourceTypeEnum.Env:
        return $localize`:@@common.environment:Environment`;
      case ResourceTypeEnum.Flag:
        return $localize`:@@common.flag:Flag`;
      case ResourceTypeEnum.Segment:
        return $localize`:@@common.segment:Segment`;
      default:
        return '';
    }
  }
}
