import { Directive, ViewContainerRef } from "@angular/core";

@Directive({
  selector: '[instruction-host]'
})
export class InstructionDirective {

  constructor(public viewContainerRef: ViewContainerRef) { }

}
