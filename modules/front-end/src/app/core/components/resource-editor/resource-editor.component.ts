import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from "@angular/core";
import {
  ResourceParamTypeEnum,
  ResourceParamViewModel,
  ResourceType,
  RNViewModel,
  rscParamsDict
} from "@shared/policy";
import { deepCopy, uuidv4 } from "@utils/index";

export interface IResourceEditorOutputModel {
  id: string;
  val: string;
}

@Component({
  selector: 'resource-editor',
  templateUrl: './resource-editor.component.html',
  styleUrls: ['./resource-editor.component.less'],
  standalone: false
})
export class ResourceEditorComponent implements OnInit, OnChanges {
  rscParams: ResourceParamViewModel[] = [];
  model: RNViewModel;

  @Input() visible: boolean = false;
  @Input() resourceType: ResourceType;
  @Input() rn: RNViewModel;

  async ngOnInit() {
    this.initFromRn();
  }

  ngOnChanges(changes: SimpleChanges) {
    // re-initialize whenever visible becomes true, or rn changes
    if (!this.resourceType) return;
    if (changes['visible']?.currentValue === true || changes['rn']) {
      this.initFromRn();
    }
  }

  private initFromRn() {
    if (!this.resourceType) return;

    this.reset(); // always reset rscParams first

    // nothing to parse for a new resource
    if (!this.rn) {
      return;
    }

    this.model = { id: this.rn.id || uuidv4(), val: this.rn.val, isInvalid: false };

    // a complete RN example: project/*;tag1,tag2:env/*-env;tag3,tag4
    const paramValues = this.rn.val.split(':')
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

  private reset = () => {
    this.model = {} as RNViewModel;
    //deep copy
    this.rscParams = deepCopy(rscParamsDict[this.resourceType.type]);
  }

  vmValChanged = () => {
    this.model.isInvalid = false;

    this.rscParams.forEach((param, idx) => {
      switch (param.type) {
        case ResourceParamTypeEnum.Tag:
          if (param.val?.trim()?.length > 0) {
            const tags = param.val?.split(',')?.map(tag => tag.trim());
            if (tags && tags.length > 0) {
              this.model.val = `${this.model.val};${tags.join(',')}`;
            }
          }
          break;
        default:
          const regex = new RegExp(param.placeholder.name, 'ig');
          if (idx === 0) {
            this.model.val = this.resourceType.pattern.replace(regex, param.val);
          } else {
            this.model.val = this.model.val.replace(regex, param.val);
          }
      }

      if (param.val !== '*') {
        param.isAnyChecked = false;
      }
      param.isInvalid = param.val?.includes(':') || param.val?.includes('{') || param.val?.includes('}');
      this.model.isInvalid ||= param.isInvalid;
    });
  }

  isValAnyCheckedChanged = (val: any) => {
    if (val.isAnyChecked) {
      val.val = '*';
    } else {
      val.val = '';
    }

    this.vmValChanged();
  }

  @Output() onCancel: EventEmitter<boolean> = new EventEmitter();
  @Output() onSave: EventEmitter<IResourceEditorOutputModel> = new EventEmitter();

  close = () => {
    this.onCancel.emit();
  }

  save = () => {
    const {id, val} = this.model;
    this.onSave.emit({id, val});
  }
}
