import { Component } from "@angular/core";
import {
  IInstructionComponent,
  IInstructionComponentData
} from "@core/components/change-list/instructions/types";

@Component({
  selector: 'add-target-users',
  template: `
    <div class="instruction">
      <span i18n="@@common.remove-tags">Remove tags</span>
      <nz-tag *ngFor="let tag of tags">
        {{tag}}
      </nz-tag>
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
export class RemoveTagsComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  get tags(): string[] {
    const value = this.data.value as string[];
    return value;
  }
}
