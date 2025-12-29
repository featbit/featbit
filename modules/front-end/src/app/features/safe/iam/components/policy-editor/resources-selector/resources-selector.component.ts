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

@Component({
    selector: 'resources-selector',
    templateUrl: './resources-selector.component.html',
    styleUrls: ['./resources-selector.component.less'],
    standalone: false
})
export class ResourcesSelectorComponent {
  rscParams: ResourceParamViewModel[] = [];

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
    this.editModalVisible = true;
    this.currentRn = { id: rsc.id, val: rsc.rn, isInvalid: false };

    // a complete RN example: project/*;tag1,tag2:env/*-env;tag3,tag4
    const paramValues = rsc.rn.split(':')
      .flatMap(r => {
        // example of r: project/*;tag1,tag2
        // split key and others (currently only tags, we may have other params here)
        const parts = r.split(';');
        // get param type and key
        const typeParts = parts[0].split('/');

        // split others (tags etc.)
        let tagsParam = [];
        const tags = parts[1]?.split(',')?.map(part => part.trim());
        if (tags && tags.length > 0) {
          tagsParam = [{type: ResourceParamTypeEnum.Tag, val: tags.join(','), isAnyChecked: undefined }];
        }

        return [
          {type: typeParts[0], val: typeParts[1], isAnyChecked: typeParts[1] === '*' },
          ...tagsParam
        ];
      })
      .reduce((acc, { type, val, isAnyChecked}) => {
        acc[type] = { val: val, isAnyChecked };
        return acc;
      }, {});

    if (paramValues) {
      this.rscParams = this.rscParams.map(p => ({...p, val: paramValues[p.type]?.val, isAnyChecked: paramValues[p.type]?.isAnyChecked}));
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

    this.rscParams.forEach((param, idx) => {
      switch (param.type) {
        case ResourceParamTypeEnum.Tag:
          const tags = param.val?.split(',')?.map(tag => tag.trim());
          if (tags && tags.length > 0) {
            this.currentRn.val = `${this.currentRn.val};${tags.join(',')}`;
          }
          break;
        default:
          const regex = new RegExp(param.placeholder.name, 'ig');
          if (idx === 0) {
            this.currentRn.val = this.resourceType.pattern.replace(regex, param.val);
          } else {
            this.currentRn.val = this.currentRn.val.replace(regex, param.val);
          }
      }

      param.isInvalid = param.val?.includes(':') || param.val?.includes('{') || param.val?.includes('}');
      this.currentRn.isInvalid ||= param.isInvalid;
    });
  }
}
