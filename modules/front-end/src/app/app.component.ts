import { Component } from '@angular/core';
import packageInfo from '../../package.json';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.less']
})
export class AppComponent {

  constructor() {
    console.log(`Current Version: ${packageInfo.version}`);
  }
}

