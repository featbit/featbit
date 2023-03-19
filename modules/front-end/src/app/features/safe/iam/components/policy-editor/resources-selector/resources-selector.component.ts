import { Component, EventEmitter, Input, Output, ViewChild } from "@angular/core";
import { NzSelectComponent } from "ng-zorro-antd/select";
import {
  isResourceGeneral,
  Resource,
  ResourceParamViewModel,
  ResourceType,
  RNViewModel,
  rscParamsDict
} from "@shared/policy";
import { ResourceService } from "@services/resource.service";
import { deepCopy } from "@utils/index";

@Component({
  selector: 'resources-selector',
  templateUrl: './resources-selector.component.html',
  styleUrls: ['./resources-selector.component.less']
})
export class ResourcesSelectorComponent {
  rscParams: ResourceParamViewModel[] = [];

  constructor(private resourceService: ResourceService) {}

  availableResources: Resource[];

  @Output() onSelectedResourcesChange = new EventEmitter<Resource[]>();
  resourceType: ResourceType;
  @Input('resourceType')
  set _(data: ResourceType){
    if (data) {
      const previousType = this.resourceType?.type;
      this.resourceType = data;
      this.resetModalParams();
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
    this.resourceService.getAll(this.resourceType?.type, query).subscribe(resources => {
      this.availableResources = [...resources];
      this.isResourceLoading = false;
    }, _ => this.isResourceLoading = false);
  }

  isSelected(rsc: Resource) {
    return this.selectedResources.findIndex(s => s.rn === rsc.rn) !== -1;
  }

  getDigest(rsc: Resource) {
    return rsc.rn;
  }

  editModalVisible = false;
  openEditModal(rsc: Resource) {
    this.editModalVisible = true;
    this.currentRn = { id: rsc.id, val: rsc.rn, isInvalid: false };

    const paramValues = rsc.rn.split(':')
      .map(r => {
        const part = r.split('/');
        return {type: part[0], val: part[1], isAnyChecked: part[1] === '*' }})
      .reduce((acc, { type, val, isAnyChecked}) => {
        acc[type] = { val: val, isAnyChecked };
        return acc;
      }, {});

    if (paramValues) {
      this.rscParams = this.rscParams.map(p => ({...p, val: paramValues[p.resourceType].val, isAnyChecked: paramValues[p.resourceType].isAnyChecked}));
    }
  }

  closeModal() {
    this.editModalVisible = false;
    this.resetModalParams();
  }

  resetModalParams() {
    this.currentRn = {} as RNViewModel;
    //deep copy
    this.rscParams = deepCopy(rscParamsDict[this.resourceType.type]);
  }

  save() {
    this.selectedResources = this.selectedResources.map(rsc => {
      if (rsc.id !== this.currentRn.id) {
        return rsc;
      }

      return {
        ...rsc,
        rn: this.currentRn.val
      }
    })

    this.closeModal();
    this.resetModalParams();
    this.onSelectedResourcesChange.next(this.selectedResources);
    this.validate();
  }

  isValAnyCheckedChanged(val: any) {
    if (val.isAnyChecked) {
      val.val = '*';
    } else {
      val.val = '';
    }

    this.vmValChanged();
  }

  currentRn: RNViewModel;

  vmValChanged() {
    this.currentRn.isInvalid = false;

    this.rscParams.forEach((val, idx) => {
      const regex = new RegExp(val.placeholder.name, 'ig');

      if (idx === 0) {
        this.currentRn.val = this.resourceType.pattern.replace(regex, val.val);
      } else {
        this.currentRn.val = this.currentRn.val.replace(regex, val.val);
      }

      val.isInvalid = val.val.includes(':') || val.val.includes('{') || val.val.includes('}');
      this.currentRn.isInvalid ||= val.isInvalid;
    });
  }
}
