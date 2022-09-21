import {Inject, LOCALE_ID, Pipe, PipeTransform} from "@angular/core";
import ResourceTranslation from "@core/translations/resource.translation";
import ResourceTypeTranslation from "@core/translations/resource-type.translation";
import IamOperationTranslation from "@core/translations/iam-operation.translation";
import IamActionTranslation from "@core/translations/iam-action.translation";

const translationType = {
  resource: 'resource',
  resourceType: 'resource-type',
  op: 'operation',
  action: 'action'
}

@Pipe({ name: "T" })
export class TranslationPipe implements PipeTransform {
  constructor(@Inject(LOCALE_ID) private locale: string) {
  }

  transform(value, defaultValue, type: 'resource' | 'resource-type' | 'operation' | 'action') {
    let result;
    switch (type){
      case translationType.resource:
        result = ResourceTranslation[value] ? ResourceTranslation[value][this.locale] : null
        break;
      case translationType.resourceType:
        result = ResourceTypeTranslation[value] ? ResourceTypeTranslation[value][this.locale] : null
        break;
      case translationType.op:
        result = IamOperationTranslation[value] ? IamOperationTranslation[value][this.locale] : null
        break;
      case translationType.action:
        result = IamActionTranslation[value] ? IamActionTranslation[value][this.locale] : null
        break;
      default:
        result = null;
    }

    return result || defaultValue;
  }
}
