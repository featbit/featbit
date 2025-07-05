import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import {
  groupResources,
  isChildResourceOf,
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
      this.selectedItems = this.groupedItems
      .flatMap(x => x.items.filter(x => this.defaultSelected.includes(x.id)));

      const selectedChildren = this.selectedItems
      .flatMap(x => this.getChildResources(x))
      .map(x => x.id);

      for (const group of this.groupedItems) {
        for (const resource of group.items) {
          resource.selected = selectedChildren.includes(resource.id) || this.defaultSelected.includes(resource.id);
          resource.disabled = selectedChildren.includes(resource.id) || resource.rn === this.unremovableRn;
        }
      }
    }
  }
  @Input()
  resources: ResourceTypeEnum[] = [ ResourceTypeEnum.Project, ResourceTypeEnum.Env, ResourceTypeEnum.Flag, ResourceTypeEnum.Segment ];
  @Input()
  spaceLevel: ResourceSpaceLevel = ResourceSpaceLevel.Organization;
  @Input()
  defaultSelected: string[] = [];
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
    // remove all children from selected items and then add the parent
    this.selectedItems = this.selectedItems.filter(x => !isChildResourceOf(x.rn, item.rn) || x.rn == this.unremovableRn);
    this.selectedItems.push(item);

    // select current item and all its children
    item.selected = true;
    item.disabled = false;

    this.getChildResources(item).forEach(x => {
      x.selected = true;
      x.disabled = true;
    });
  }

  removeFromSelected(item: SelectableResourceV2) {
    this.selectedItems = this.selectedItems.filter(x => x.rn !== item.rn);

    // deselect current item and all its children
    item.selected = false;
    item.disabled = false;

    this.getChildResources(item).forEach(x => {
      x.selected = false;
      x.disabled = false;
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

  private getChildResources(resource: ResourceV2): SelectableResourceV2[] {
    return this.groupedItems.flatMap(
      group => group.items.filter(x => isChildResourceOf(x.rn, resource.rn))
    );
  }
}
