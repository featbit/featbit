import { Component, ElementRef, EventEmitter, Input, Output, ViewChild } from '@angular/core';
import { environment } from "src/environments/environment";

interface Step {
  title: string;
  description: string
}

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
