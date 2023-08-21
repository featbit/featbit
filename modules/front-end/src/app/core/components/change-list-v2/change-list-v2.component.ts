import { Component, Input } from "@angular/core";
import {
  ICategoryInstruction, IChangeListParam,
  IInstruction,
  IInstructionKindComponent
} from "@core/components/change-list-v2/instructions/types";
import { instructionCategories } from "@core/components/change-list-v2/constants";

@Component({
  selector: 'change-list-v2',
  templateUrl: './change-list-v2.component.html'
})
export class ChangeListV2Component {

  categories: ICategoryInstruction[] = [];

  constructor(
  ) { }

  @Input()
  set param (param: IChangeListParam) {
    this.categories = instructionCategories.map((category: ICategoryInstruction) => {
      const instructions = category.instructions.filter((instruction: IInstructionKindComponent) => {
        const i = param.instructions.find((i: IInstruction) => i.kind === instruction.kind);
        instruction.value = i?.value;
        instruction.previous = param.previous;
        instruction.current = param.current;
        return !!i;
      });
      return { ...category, instructions };
    }).filter((category: ICategoryInstruction) => category.instructions.length > 0);
  }
}
