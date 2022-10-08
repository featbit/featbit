import { Component, Input } from '@angular/core';

@Component({
  selector: 'guide-drawer',
  templateUrl: './guide.component.html',
  styleUrls: ['./guide.component.less']
})
export class GuideComponent {

  @Input()
  isVisible = true;

  onClose() {
    this.isVisible = false;
  }
}
