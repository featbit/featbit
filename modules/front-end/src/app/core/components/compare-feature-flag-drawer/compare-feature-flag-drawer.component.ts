import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'compare-feature-flag-drawer',
  standalone: false,
  templateUrl: './compare-feature-flag-drawer.component.html',
  styleUrl: './compare-feature-flag-drawer.component.less'
})
export class CompareFeatureFlagDrawerComponent {
  @Input()
  visible: boolean = false;

  @Output()
  close: EventEmitter<void> = new EventEmitter();

  onClose() {
    this.visible = false;
    this.close.emit();
  }
}
