import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IUserType } from "@shared/types";

@Component({
  selector: 'end-user-drawer',
  templateUrl: './end-user-drawer.component.html',
  styleUrls: ['./end-user-drawer.component.less']
})
export class EndUserDrawerComponent {
  @Input()
  isVisible: boolean = false;


  _user: IUserType;
  @Input()
  set user(value: IUserType) {
    this._user = value;
    if (value) {
      this.builtInProps.push({name: 'keyId', value: value.keyId});
      this.builtInProps.push({name: 'name', value: value.name});

      value.customizedProperties.forEach((prop) => {
        this.customizedProperties.push(prop);
      });
    }
  }

  @Output()
  close: EventEmitter<void> = new EventEmitter<void>();

  onClose() {
    this.builtInProps = [];
    this.customizedProperties = [];
    this.close.emit();
  }

  builtInProps: { name: string, value: string }[] = [];
  customizedProperties: { name: string, value: string }[] = [];
}
