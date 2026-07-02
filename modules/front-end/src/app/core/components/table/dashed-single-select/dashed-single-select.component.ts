import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NzDropDownDirective, NzDropdownMenuComponent } from "ng-zorro-antd/dropdown";
import { NzButtonComponent } from "ng-zorro-antd/button";
import { NzIconDirective } from "ng-zorro-antd/icon";
import { NzMenuDirective, NzMenuItemComponent } from "ng-zorro-antd/menu";

type FilterOption = {
  label: string;
  value: any;
};

@Component({
  selector: 'dashed-single-select',
  templateUrl: './dashed-single-select.component.html',
  imports: [
    NzDropdownMenuComponent,
    NzDropDownDirective,
    NzButtonComponent,
    NzIconDirective,
    NzMenuDirective,
    NzMenuItemComponent
  ],
  styleUrl: './dashed-single-select.component.less'
})
export class DashedSingleSelectComponent {
  @Input()
  label: string = '';

  @Input()
  options: FilterOption[] = [];

  @Input()
  value: any = undefined;

  @Output()
  valueChange = new EventEmitter<any>();

  get selectedLabel(): string {
    const selectedOption = this.options.find(o => o.value === this.value);
    if (!selectedOption) {
      return $localize`:@@common.any:Any`;
    }

    return selectedOption.label;
  }

  get hasValue(): boolean {
    return this.options.some(o => o.value === this.value);
  }

  selectOption(option: FilterOption) {
    this.valueChange.emit(option.value);
  }

  clearValue(event: MouseEvent) {
    event.stopPropagation();
    this.valueChange.emit(undefined);
  }
}
