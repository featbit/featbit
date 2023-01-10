import {Inject, LOCALE_ID, Pipe, PipeTransform} from "@angular/core";
import ResourceTranslation from "@core/translations/resource.translation";
import IamOperationTranslation from "@core/translations/iam-operation.translation";
import ExptStatusTranslation from "@core/translations/expt-status.translation";
import TriggerTypeTranslation from "@core/translations/trigger-type.translation";

const translationType = {
  resource: 'resource',
  op: 'operation',
  exptStatus: 'expt-status',
  triggerType: 'trigger-type'
}

@Pipe({ name: "T" })
export class TranslationPipe implements PipeTransform {
  constructor(@Inject(LOCALE_ID) private locale: string) {
  }

  transform(value, defaultValue, type: 'resource' | 'operation' | 'expt-status' | 'trigger-type') {
    let result;
    switch (type){
      case translationType.resource:
        result = ResourceTranslation[value] ? ResourceTranslation[value][this.locale] : null
        break;
      case translationType.op:
        result = IamOperationTranslation[value] ? IamOperationTranslation[value][this.locale] : null
        break;
      case translationType.exptStatus:
        result = ExptStatusTranslation[value] ? ExptStatusTranslation[value][this.locale] : null
        break;
      case translationType.triggerType:
        result = TriggerTypeTranslation[value] ? TriggerTypeTranslation[value][this.locale] : null
        break;
      default:
        result = null;
    }

    return result || defaultValue;
  }
}
