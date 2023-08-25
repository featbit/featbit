import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IVariationTargetUsers,
} from "@core/components/change-list/instructions/types";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'remove-target-users',
  template: `
    <div class="instruction">
      <span i18n="@@common.remove-users">Remove user(s)</span>
      <nz-tag *ngFor="let keyId of keyIds">
        {{keyId}}
      </nz-tag>
      <span i18n="@@common.from-variation">from variation</span>
      <nz-tag>{{variation}}</nz-tag>
    </div>
  `,
  styles: [`
    nz-tag {
      line-height: 12px;
      height: 19px;
      border-radius: 5px;
      margin-left: 2px;
      margin-right: 2px;
    }
  `]
})
export class RemoveTargetUsersComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get variation(): string {
    const currentFlag = this.data.current as IFeatureFlag;
    const value = this.data.value as IVariationTargetUsers;
    return currentFlag.variations.find((v) => v.id === value.variationId)?.name ?? value.variationId;
  }

  get keyIds(): string[] {
    const value = this.data.value as IVariationTargetUsers;
    return value.keyIds;
  }
}
