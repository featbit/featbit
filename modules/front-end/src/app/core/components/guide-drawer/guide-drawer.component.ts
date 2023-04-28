import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'guide-drawer',
  templateUrl: './guide-drawer.component.html',
  styleUrls: ['./guide-drawer.component.less']
})
export class GuideDrawerComponent {

  @Input()
  isVisible = true;
  @Output() guideDrawerClosed: EventEmitter<any> = new EventEmitter();


  constructor(
  ) {
  }

  onClose() {
    this.guideDrawerClosed.emit();
  }
}
