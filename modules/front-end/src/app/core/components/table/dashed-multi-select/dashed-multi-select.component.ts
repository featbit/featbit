import { Component, EventEmitter, Input, Output, TemplateRef } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { NzDropDownDirective, NzDropdownMenuComponent } from "ng-zorro-antd/dropdown";
import { NzInputDirective, NzInputGroupComponent } from "ng-zorro-antd/input";
import { NzSpinComponent } from "ng-zorro-antd/spin";
import { NzButtonComponent } from "ng-zorro-antd/button";
import { NzIconDirective } from "ng-zorro-antd/icon";
import { FormsModule } from "@angular/forms";

export type SelectableOptions = {
  label: string;
  value: string;
  selected: boolean;
};

@Component({
  selector: 'dashed-multi-select',
  templateUrl: './dashed-multi-select.component.html',
  styleUrl: './dashed-multi-select.component.less',
  imports: [
    NzDropdownMenuComponent,
    NzInputGroupComponent,
    NzSpinComponent,
    NzDropDownDirective,
    NzButtonComponent,
    NzIconDirective,
    NzInputDirective,
    FormsModule,
    NgTemplateOutlet
  ]
})
export class DashedMultiSelectComponent {
  @Input()
  label: string = '';

  @Input()
  options: SelectableOptions[] = [];

  @Input()
  isLoading: boolean = false;

  @Input()
  labelTemplate: TemplateRef<void> | null = null;

  @Output()
  optionsChange = new EventEmitter<string[]>();

  searchText: string = '';

  get filteredOptions(): SelectableOptions[] {
    if (!this.searchText) {
      return this.options;
    }

    const searchLower = this.searchText.toLowerCase();
    return this.options.filter(tag => tag.label.toLowerCase().includes(searchLower));
  }

  getSelectedOptionsLabel(): string {
    const selected = this.options.filter(t => t.selected);
    if (selected.length === 0) {
      return $localize`:@@common.any:Any`;
    }

    if (selected.length <= 2) {
      return selected.map(t => t.label).join(', ');
    }

    return `${selected.length} ` + $localize`:@@common.selected:Selected`;
  }

  get hasValue(): boolean {
    return this.options.some(t => t.selected);
  }

  clearOptions(event: MouseEvent) {
    event.stopPropagation();

    this.options.forEach(t => t.selected = false);
    this.optionsSnapshot = [];
    this.optionsChange.emit([]);
  }

  private optionsSnapshot: string[] = [];

  onVisibleChange(visible: boolean) {
    this.searchText = '';

    if (visible) {
      this.optionsSnapshot = this.options.filter(t => t.selected).map(t => t.value);
    } else {
      const current = this.options.filter(t => t.selected).map(t => t.value);
      const changed =
        current.length !== this.optionsSnapshot.length ||
        current.some(name => !this.optionsSnapshot.includes(name));
      if (changed) {
        this.optionsChange.emit(current);
      }
    }
  }
}
