import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'guide-drawer',
  templateUrl: './guide.component.html',
  styleUrls: ['./guide.component.less']
})
export class GuideComponent {

  @Input()
  isVisible = true;
  @Output() guideDrawerClosed: EventEmitter<any> = new EventEmitter();

  onClose() {
    this.guideDrawerClosed.emit();
  }
}
