import { Component, Input, OnInit } from '@angular/core';
import { ResourceFilterV2, ResourceTypeEnum } from "@shared/policy";
import { ResourceService } from "@services/resource.service";
import { debounceTime } from "rxjs/operators";
import { Subject } from "rxjs";

interface GroupedItem {
  name: string;
  items: Item[];
}

interface Item {
  id: string;
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

  constructor(private resourceService: ResourceService) {
  }

  groupedItems: GroupedItem[] = [];
  $search = new Subject<void>();
  isLoading = true;
  filter: ResourceFilterV2 = {
    name: '',
    types: []
  };

  ngOnInit(): void {
    this.filter.types = this.resources;
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

  private fetchResources() {
    this.groupedItems = [];
    this.isLoading = true;
    this.resourceService.getResourcesV2(this.filter).subscribe(resources => {
      for (const resource of resources) {
        // filter out general resources
        if (resource.rn.includes('*')) {
          continue;
        }

        const type = this.mapResourceType(resource.type);
        const group = this.groupedItems.find(x => x.name === type);
        if (group) {
          group.items.push({
            id: resource.id,
            name: resource.name
          });
        } else {
          this.groupedItems.push({
            name: type,
            items: [{
              id: resource.id,
              name: resource.name
            }]
          });
        }
      }

      this.isLoading = false;
    });
  }

  private mapResourceType(type: ResourceTypeEnum): string {
    switch (type) {
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
