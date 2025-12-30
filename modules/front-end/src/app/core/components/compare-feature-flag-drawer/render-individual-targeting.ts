import { Component, Input } from "@angular/core";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'render-individual-targeting',
  template: `
    @if (data.flag.targetUsers.length === 0) {
      <span i18n="@@ff.compare.no-individual-targeting">No Individual Targeting</span>
    } @else {
      @for (variationUser of variationUsers; track variationUser.variation.id) {
        <div class="individual-targeting-entry">
          <strong i18n="@@ff.compare.variation">Variation:</strong> {{ variationUser.variation.name }}
          ({{ variationUser.variation.value }})
          <br/>
          <strong i18n="@@ff.compare.users">Users:</strong> {{ variationUser.users.join(', ') }}
        </div>
      }
    }
  `
})
export class RenderIndividualTargeting {
  @Input()
  data: { flag: IFeatureFlag }

  get variationUsers() {
    const flag = this.data.flag;

    return flag.targetUsers.map(tu => ({
      variation: flag.variations.find(v => v.id === tu.variationId),
      users: tu.keyIds,
    }));
  }
}
