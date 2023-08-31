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
      <ng-container *ngIf="kind === InstructionKindEnum.AddTargetUsersToExcluded || kind === InstructionKindEnum.RemoveTargetUsersFromExcluded">
        <span class="variation" i18n="@@common.excluding-users" >Excluding users</span>:
      </ng-container>
      <ng-container *ngIf="kind === InstructionKindEnum.AddTargetUsersToIncluded || kind === InstructionKindEnum.RemoveTargetUsersFromIncluded">
        <span class="variation" i18n="@@common.including-users" >Including users</span>:
      </ng-container>
      <span i18n="@@common.add-users" *ngIf="kind === InstructionKindEnum.AddTargetUsersToExcluded || kind === InstructionKindEnum.AddTargetUsersToIncluded">Add user(s)</span>
      <span i18n="@@common.remove-users" *ngIf="kind === InstructionKindEnum.RemoveTargetUsersFromExcluded || kind === InstructionKindEnum.RemoveTargetUsersFromIncluded">Remove user(s)</span>
      <nz-tag *ngFor="let keyId of keyIds">
        {{keyId}}
      </nz-tag>
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
