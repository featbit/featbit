import { Directive, ViewContainerRef } from "@angular/core";

@Directive({
    selector: '[instruction-host]',
    standalone: false
})
export class InstructionDirective {

  constructor(public viewContainerRef: ViewContainerRef) { }

}
