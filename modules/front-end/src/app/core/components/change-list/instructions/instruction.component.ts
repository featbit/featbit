import { Component, Input, ViewChild } from "@angular/core";
import { IInstructionKindComponent } from "@core/components/change-list/instructions/types";
import { InstructionDirective } from "@core/components/change-list/instructions/instruction.directive";
import { IInstructionComponent } from "@core/components/change-list/instructions/types";

@Component({
  selector: 'instruction',
  template: `<div instruction-host></div>`
})
export class InstructionComponent {

  @ViewChild(InstructionDirective, { static: true }) instructionRef: InstructionDirective;

  @Input()
  set instruction(ins: IInstructionKindComponent) {
    const componentRef = this.instructionRef.viewContainerRef.createComponent<IInstructionComponent>(ins.component);
    const { kind, value, previous, current } = ins;
    componentRef.instance.data = { kind, value, previous, current };
  }

  constructor() {
  }
}
