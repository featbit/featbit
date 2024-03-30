import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ResourceFilterV2, ResourceSpaceLevel, ResourceTypeEnum, ResourceV2 } from "@shared/policy";
import { ResourceService } from "@services/resource.service";
import { debounceTime } from "rxjs/operators";
import { Subject } from "rxjs";

interface GroupedItem {
  name: string;
  items: Item[];
}

interface Item {
  rn: string;
  name: string;
}

@Component({
  selector: 'resource-finder',
  templateUrl: './resource-finder.component.html',
  styleUrls: ['./resource-finder.component.less']
})
export class ResourceFinderComponent implements OnInit {
  @Input()
  isVisible = false;
  @Input()
  resources: ResourceTypeEnum[] = [ResourceTypeEnum.Project, ResourceTypeEnum.Env, ResourceTypeEnum.Flag, ResourceTypeEnum.Segment];
  @Input()
  spaceLevel: ResourceSpaceLevel = ResourceSpaceLevel.Organization;
  @Output()
  onClose: EventEmitter<string[]> = new EventEmitter<string[]>();

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

  selectedItems: Item[] = [];

  toggleSelected(item: Item) {
    let existedItem = this.selectedItems.find(x => x.rn === item.rn);
    if (existedItem) {
      this.removeFromSelected(existedItem);
    } else {
      this.addToSelected(item);
    }
  }

  addToSelected(item: Item) {
    this.selectedItems.push(item);
  }

  removeFromSelected(item: Item) {
    this.selectedItems = this.selectedItems.filter(x => x.rn !== item.rn);
  }

  onCancel() {
    this.isVisible = false;
    this.onClose.emit([]);
  }

  onContinue() {
    this.isVisible = false;
    this.onClose.emit(this.selectedItems.map(x => x.rn));
  }

  private fetchResources() {
    this.groupedItems = [];
    this.isLoading = true;
    this.resourceService.getResourcesV2(this.filter).subscribe(resources => {
      for (const resource of resources) {
        const type = this.mapResourceType(resource.type);
        const group = this.groupedItems.find(x => x.name === type);
        if (group) {
          group.items.push({
            rn: resource.rn,
            name: resource.pathName
          });
        } else {
          this.groupedItems.push({
            name: type,
            items: [{
              rn: resource.rn,
              name: resource.pathName
            }]
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
