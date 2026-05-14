import { Component, EventEmitter, Input, Output, ViewChild } from "@angular/core";
import { NzSelectComponent } from "ng-zorro-antd/select";
import {
  isResourceGeneral,
  Resource, ResourceFilter, ResourceParamTypeEnum,
  ResourceParamViewModel,
  ResourceType,
  RNViewModel,
  rscParamsDict
} from "@shared/policy";
import { ResourceService } from "@services/resource.service";
import { deepCopy } from "@utils/index";
import { IResourceEditorOutputModel } from "@core/components/resource-editor/resource-editor.component";

@Component({
    selector: 'resources-selector',
    templateUrl: './resources-selector.component.html',
    styleUrls: ['./resources-selector.component.less'],
    standalone: false
})
export class ResourcesSelectorComponent {
  constructor(private resourceService: ResourceService) {}

  availableResources: Resource[];

  @Output() onSelectedResourcesChange = new EventEmitter<Resource[]>();
  isResourceTypeGeneral: boolean = false;
  resourceType: ResourceType;
  @Input('resourceType')
  set _(data: ResourceType){
    if (data) {
      const previousType = this.resourceType?.type;
      this.resourceType = data;
      this.isResourceTypeGeneral = isResourceGeneral(this.resourceType.type, this.resourceType.pattern);
      if (data.type !== previousType) {
        this.onSearchResources('');
      }
    }
  }

  @Input() isInvalid: boolean = false;

  @ViewChild("resourcesSelector", { static: true }) selectNode: NzSelectComponent;
  resourceSelectModel: Resource;
  @Input() selectedResources: Resource[] = [];

  onResourceChange() {
    if (isResourceGeneral(this.resourceSelectModel.type, this.resourceSelectModel.rn)) {
      this.selectedResources = [];
    } else {
      this.selectedResources = this.selectedResources.filter((r) => !isResourceGeneral(r.type, r.rn))
    }
    this.selectedResources = [...this.selectedResources, {...this.resourceSelectModel}];
    this.onSelectedResourcesChange.next(this.selectedResources);
    this.selectNode.writeValue(undefined);
    this.validate();
  }

  validate() {
    this.isInvalid = this.selectedResources.length === 0;
  }

  removeResource(rsc: Resource){
    this.selectedResources = this.selectedResources.filter(s => s.name !== rsc.name);
    this.onSelectedResourcesChange.next(this.selectedResources);
    this.validate();
  }

  isResourceLoading = false;
  onSearchResources(query: string) {
    this.isResourceLoading = true;
    const filter: ResourceFilter = {
      name: query,
      type: this.resourceType?.type
    };
    this.resourceService.getResources(filter).subscribe({
      next: resources => {
        this.availableResources = [...resources];
        this.isResourceLoading = false;
      },
      error: _ => this.isResourceLoading = false
    });
  }

  isSelected(rsc: Resource) {
    return this.selectedResources.findIndex(s => s.rn === rsc.rn) !== -1;
  }

  getDigest(rsc: Resource) {
    return rsc.rn;
  }

  editModalVisible = false;
  openEditModal(rsc: Resource) {
    this.currentRn = { id: rsc.id, val: rsc.rn, isInvalid: false };
    this.editModalVisible = true;
  }

  closeModal() {
    this.editModalVisible = false;
  }

  save(data: IResourceEditorOutputModel) {
    const {id, val} = data;
    this.selectedResources = this.selectedResources.map(rsc => {
      if (rsc.id !== id) {
        return rsc;
      }

      return {
        ...rsc,
        rn: val
      }
    })

    this.closeModal();
    this.onSelectedResourcesChange.next(this.selectedResources);
    this.validate();
  }

  currentRn: RNViewModel;
}
