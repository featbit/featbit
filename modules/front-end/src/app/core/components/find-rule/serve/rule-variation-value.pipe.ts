import {Pipe, PipeTransform} from "@angular/core";
import {IVariation} from "@shared/rules";

@Pipe({ name: "RVV" })
export class RuleVariationValuePipe implements PipeTransform {
  constructor() {
  }

  transform(variationId: string, variationOptions: IVariation[]) {
    return variationOptions.find(v => v.id === variationId)?.name || variationId;
  }
}
