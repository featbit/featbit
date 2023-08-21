import { Component, Input, ViewChild } from "@angular/core";
import { IInstructionKindComponent } from "@core/components/change-list-v2/instructions/types";
import { InstructionDirective } from "@core/components/change-list-v2/instructions/instruction.directive";
import { IInstructionComponent } from "@core/components/change-list-v2/instructions/types";

@Component({
  selector: 'instruction',
  template: `<div class="instruction" instruction-host></div>`
})
export class InstructionComponent {

  @ViewChild(InstructionDirective, { static: true }) instructionRef: InstructionDirective;

  @Input()
  set instruction(ins: IInstructionKindComponent) {
    const componentRef = this.instructionRef.viewContainerRef.createComponent<IInstructionComponent>(ins.component);
    const { value, previous, current } = ins;
    componentRef.instance.data = { value, previous, current };
  }

  constructor() {
  }
}
