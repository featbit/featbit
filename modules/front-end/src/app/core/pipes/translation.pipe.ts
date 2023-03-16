import {Inject, LOCALE_ID, Pipe, PipeTransform} from "@angular/core";
import ResourceTranslation from "@core/translations/resource.translation";
import ExptStatusTranslation from "@core/translations/expt-status.translation";
import TriggerTypeTranslation from "@core/translations/trigger-type.translation";

const translationType = {
  resource: 'resource',
  effect: 'effect',
  exptStatus: 'expt-status',
  triggerType: 'trigger-type'
}

@Pipe({ name: "T" })
export class TranslationPipe implements PipeTransform {
  constructor(@Inject(LOCALE_ID) private locale: string) {
  }

  transform(value, defaultValue, type: 'resource' | 'effect' | 'expt-status' | 'trigger-type') {
    let result = null;
    switch (type){
      case translationType.resource:
        result = ResourceTranslation[value] ? ResourceTranslation[value][this.locale] : null
        break;
      case translationType.effect:
        const effectAllow = new RegExp('allow', 'i');
        const effectDeny = new RegExp('deny', 'i');

        if (value.match(effectAllow)) {
          result = $localize `:@@iam.effect.allow:Allow`;
        } else if (value.match(effectDeny)) {
          result = $localize `:@@iam.effect.deny:Deny`;
        }

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
