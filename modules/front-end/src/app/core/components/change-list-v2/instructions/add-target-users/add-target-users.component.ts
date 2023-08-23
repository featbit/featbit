import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IVariationTargetUsers,
} from "@core/components/change-list-v2/instructions/types";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Component({
  selector: 'add-target-users',
  template: `
    <div class="instruction">
      <span i18n="@@common.add-users">Add user(s)</span>
      <nz-tag *ngFor="let keyId of keyIds">
        {{keyId}}
      </nz-tag>
      <span i18n="@@common.to">to</span>
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
export class AddTargetUsersComponent implements IInstructionComponent {
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
