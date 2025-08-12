import { Component } from "@angular/core";
import { IInstructionComponent, IInstructionComponentData } from "@core/components/change-list/instructions/types";
import { InstructionKindEnum } from "@core/components/change-list/constants";

@Component({
  selector: 'update-tags',
  template: `
    <div class="instruction">
      @if (kind === InstructionKindEnum.AddTags) {
        <span i18n="@@common.add-tags">Add tags</span>
      }
      @if (kind === InstructionKindEnum.RemoveTags) {
        <span i18n="@@common.remove-tags">Remove tags</span>
      }
      @for (tag of tags; track tag) {
        <nz-tag>
          {{tag}}
        </nz-tag>
      }
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
export class UpdateTagsComponent implements IInstructionComponent {
  data: IInstructionComponentData;

  protected readonly InstructionKindEnum = InstructionKindEnum;
  get kind(): string {
    return this.data.kind;
  }

  get tags(): string[] {
    return this.data.value as string[];
  }
}
