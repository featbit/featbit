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
      <ng-container *ngIf="kind === InstructionKindEnum.SetTargetUsers">
        <span i18n="@@common.clear-users-with-space" *ngIf="keyIds.length === 0">Clear user(s) </span>
        <span i18n="@@common.set-users" *ngIf="keyIds.length > 0">Set user(s)</span>
        <nz-tag *ngFor="let keyId of keyIds">
          {{keyId}}
        </nz-tag>
        <span i18n="@@common.for-variation">for variation</span>
      </ng-container>
      <ng-container *ngIf="kind !== InstructionKindEnum.SetTargetUsers">
        <span i18n="@@common.add-users" *ngIf="kind === InstructionKindEnum.AddTargetUsers">Add user(s)</span>
        <span i18n="@@common.remove-users" *ngIf="kind === InstructionKindEnum.RemoveTargetUsers">Remove user(s)</span>
        <nz-tag *ngFor="let keyId of keyIds">
          {{keyId}}
        </nz-tag>
        <span i18n="@@common.from-variation" *ngIf="kind === InstructionKindEnum.RemoveTargetUsers">from variation</span>
        <span i18n="@@common.to-variation" *ngIf="kind === InstructionKindEnum.AddTargetUsers">to variation</span>
      </ng-container>
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
