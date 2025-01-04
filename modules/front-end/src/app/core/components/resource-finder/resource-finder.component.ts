import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import {
  groupResources,
  ResourceFilterV2,
  ResourceSpaceLevel,
  ResourceTypeEnum,
  ResourceV2
} from "@shared/policy";
import { ResourceService } from "@services/resource.service";
import { debounceTime } from "rxjs/operators";
import { Subject } from "rxjs";

interface SelectableResourceV2 extends ResourceV2 {
  selected: boolean;
  disabled: boolean;
}

interface GroupedSelectableResource {
  name: string;
  items: SelectableResourceV2[];
}

@Component({
  selector: 'resource-finder',
  templateUrl: './resource-finder.component.html',
  styleUrls: [ './resource-finder.component.less' ]
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
      for (const group of this.groupedItems) {
        for (const resource of group.items) {
          resource.selected = this.defaultSelected.find(x => x.rn === resource.rn) !== undefined;
          resource.disabled = resource.rn === this.unremovableRn;
        }
      }

      this.selectedItems = this.defaultSelected.map(x => ({
        ...x,
        selected: true,
        disabled: x.rn === this.unremovableRn
      }));
    }
  }
  @Input()
  resources: ResourceTypeEnum[] = [ ResourceTypeEnum.Project, ResourceTypeEnum.Env, ResourceTypeEnum.Flag, ResourceTypeEnum.Segment ];
  @Input()
  spaceLevel: ResourceSpaceLevel = ResourceSpaceLevel.Organization;
  @Input()
  defaultSelected: ResourceV2[] = [];
  @Input()
  unremovableRn: string = '';
  @Output()
  onClose: EventEmitter<ResourceV2[]> = new EventEmitter<ResourceV2[]>();

  constructor(private resourceService: ResourceService) { }

  groupedItems: GroupedSelectableResource[] = [];
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

  selectedItems: SelectableResourceV2[] = [];

  toggleSelected(item: SelectableResourceV2) {
    if (item.disabled) {
      return;
    }

    let selectedItem = this.selectedItems.find(x => x.rn === item.rn);
    if (selectedItem) {
      this.removeFromSelected(selectedItem);
    } else {
      this.addToSelected(item);
    }
  }

  addToSelected(item: SelectableResourceV2) {
    if (item.disabled) {
      return;
    }

    // remove all children from selected items and then add the parent
    this.selectedItems = this.selectedItems.filter(x => !`${x.rn}:`.startsWith(`${item.rn}:`) || x.rn == this.unremovableRn);
    this.selectedItems.push(item);

    // mark children as selected and disabled
    this.groupedItems.forEach(group => {
      group.items.forEach(listItem => {
        if (`${listItem.rn}:`.startsWith(`${item.rn}:`)) {
          listItem.selected = true;
          // disable all children except itself
          listItem.disabled = listItem.rn !== item.rn;
        }
      })
    });
  }

  removeFromSelected(item: SelectableResourceV2) {
    if (item.disabled) {
      return;
    }

    this.selectedItems = this.selectedItems.filter(x => x.rn !== item.rn);

    // mark children as not selected and not disabled
    this.groupedItems.forEach(group => {
      group.items.forEach(resource => {
        if (`${resource.rn}:`.startsWith(`${item.rn}:`) && resource.rn !== this.unremovableRn) {
          resource.selected = false;
          resource.disabled = false;
        }
      })
    });
  }

  onCancel() {
    this.onClose.emit([]);
  }

  onOk() {
    let snapshot = this.selectedItems.map(x => x);
    this.onClose.emit(snapshot);
  }

  private fetchResources() {
    this.isLoading = true;
    this.resourceService.getResourcesV2(this.filter).subscribe(resources => {
      // filter out general resources
      const concreteResources = resources.filter(x => !x.rn.includes('*'));

      this.groupedItems = groupResources(concreteResources).map(x => ({
          name: x.name,
          items: x.items.map(r => ({
              ...r,
              selected: false,
              disabled: false
            })
          )
        })
      );

      this.isLoading = false;
    });
  }
}
