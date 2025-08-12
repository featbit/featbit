import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData, IVariationTargetUsers,
} from "@core/components/change-list/instructions/types";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { InstructionKindEnum } from "@core/components/change-list/constants";

@Component({
  selector: 'update-target-users',
  template: `
    <div class="instruction">
      <span class="variation">{{variation}}</span>:
      @if (kind === InstructionKindEnum.SetTargetUsers) {
        @if (keyIds.length === 0) {
          <span i18n="@@common.clear-users">Clear user(s)</span>
        }
        @if (keyIds.length > 0) {
          <span i18n="@@common.set-users-as">Set user(s) as</span>
        }
        @for (keyId of keyIds; track keyId) {
          <nz-tag>
            {{keyId}}
          </nz-tag>
        }
      }
      @if (kind !== InstructionKindEnum.SetTargetUsers) {
        @if (kind === InstructionKindEnum.AddTargetUsers) {
          <span i18n="@@common.add-users">Add user(s)</span>
        }
        @if (kind === InstructionKindEnum.RemoveTargetUsers) {
          <span i18n="@@common.remove-users">Remove user(s)</span>
        }
        @for (keyId of keyIds; track keyId) {
          <nz-tag>
            {{keyId}}
          </nz-tag>
        }
      }
    </div>
    `,
  styles: [`
    .variation {
      font-weight: 600;
    }

    nz-tag {
      line-height: 12px;
      height: 19px;
      border-radius: 5px;
      margin-left: 2px;
      margin-right: 2px;
    }
  `]
})
export class UpdateTargetUsersComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get kind() {
    return this.data.kind;
  }

  get variation(): string {
    const currentFlag = this.data.current as IFeatureFlag;
    const value = this.data.value as IVariationTargetUsers;
    return currentFlag.variations.find((v) => v.id === value.variationId)?.name ?? value.variationId;
  }

  get keyIds(): string[] {
    const value = this.data.value as IVariationTargetUsers;
    return value.keyIds;
  }

  protected readonly InstructionKindEnum = InstructionKindEnum;
}
