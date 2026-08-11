import { Component, EventEmitter, Input, Output } from '@angular/core';
import { IUserType } from "@shared/types";

@Component({
  selector: 'end-user-drawer',
  templateUrl: './end-user-drawer.component.html',
  styleUrls: [ './end-user-drawer.component.less' ],
  standalone: false
})
export class EndUserDrawerComponent {
  @Input()
  isVisible: boolean = false;


  _user: IUserType;
  @Input()
  set user(value: IUserType) {
    this._user = value;
    if (value) {
      this.builtInProps = [
        {name: 'keyId', value: value.keyId},
        {name: 'name', value: value.name}
      ];

      this.customizedProperties = [...value.customizedProperties];
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
