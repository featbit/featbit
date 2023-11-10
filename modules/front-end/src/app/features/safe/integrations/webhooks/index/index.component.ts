import { Component } from '@angular/core';
import { Webhook } from "@features/safe/integrations/webhooks/webhooks";

@Component({
  selector: 'index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent {
  drawerVisible: boolean = false;

  webhook: Webhook;

  openDrawer() {
    this.drawerVisible = true;
  }

  closeDrawer() {
    this.drawerVisible = false;
  }
}
