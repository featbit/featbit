import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list/instructions/types";
import { InstructionKindEnum } from "@core/components/change-list/constants";

@Component({
  selector: 'update-target-users',
  template: `
    <div class="instruction">
      <span i18n="@@common.add-users" *ngIf="kind === InstructionKindEnum.AddTargetUsersToExcluded || kind === InstructionKindEnum.AddTargetUsersToIncluded">Add user(s)</span>
      <span i18n="@@common.remove-users" *ngIf="kind === InstructionKindEnum.RemoveTargetUsersFromExcluded || kind === InstructionKindEnum.RemoveTargetUsersFromIncluded">Remove user(s)</span>
      <nz-tag *ngFor="let keyId of keyIds">
        {{keyId}}
      </nz-tag>
      <span i18n="@@common.to" *ngIf="kind === InstructionKindEnum.AddTargetUsersToExcluded || kind === InstructionKindEnum.AddTargetUsersToIncluded">to</span>
      <span i18n="@@common.from-targeting-users" *ngIf="kind === InstructionKindEnum.RemoveTargetUsersFromExcluded || kind === InstructionKindEnum.RemoveTargetUsersFromIncluded">from</span>
      <nz-tag i18n="@@common.excluding-users" *ngIf="kind === InstructionKindEnum.AddTargetUsersToExcluded || kind === InstructionKindEnum.RemoveTargetUsersFromExcluded">Excluding users</nz-tag>
      <nz-tag i18n="@@common.including-users" *ngIf="kind === InstructionKindEnum.AddTargetUsersToIncluded || kind === InstructionKindEnum.RemoveTargetUsersFromIncluded">Including users</nz-tag>
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
export class UpdateTargetUsersForSegmentComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get kind() {
    return this.data.kind;
  }

  get keyIds(): string[] {
    const value = this.data.value as string[];
    return value;
  }

  protected readonly InstructionKindEnum = InstructionKindEnum;
}
