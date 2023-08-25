import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData,
} from "@core/components/change-list-v2/instructions/types";

@Component({
  selector: 'add-target-users',
  template: `
    <div class="instruction">
      <span i18n="@@common.add-users">Add user(s)</span>
      <nz-tag *ngFor="let keyId of keyIds">
        {{keyId}}
      </nz-tag>
      <span i18n="@@common.to-included">to included</span>
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
export class AddTargetUsersToIncludedComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get keyIds(): string[] {
    const value = this.data.value as string[];
    return value;
  }
}
