import { Injectable, NgZone } from "@angular/core";
import { Router } from "@angular/router";

@Injectable({
  providedIn: 'root',
})

export class BroadcastService {
  private channel = new BroadcastChannel('featbit-ui-broadcast-channel');

  constructor(private router: Router, private ngZone: NgZone) {
  }

  private _initialized = false;

  init() {
    if (this._initialized) {
      return;
    }

    this.channel.onmessage = (event) =>
      this.ngZone.run(() => {
        switch (event.data) {
          case 'env-changed':
            this.reloadPageAfterEnvironmentChanged();
            break;

          case 'user-logged-in':
            this.reloadToIndex();
            break;

          case 'user-logged-out':
            this.reloadToLogin();
            break;

          case 'org-changed':
            this.reloadToIndex();
            break;
        }
      });

    this._initialized = true;
  }

  environmentChanged() {
    this.channel.postMessage('env-changed');
    this.reloadPageAfterEnvironmentChanged();
  }

  organizationChanged() {
    this.channel.postMessage('org-changed');
    window.location.reload();
  }

  userLoggedIn() {
    this.channel.postMessage('user-logged-in');
  }

  userLoggedOut() {
    this.channel.postMessage('user-logged-out');
    this.router.navigateByUrl('/login').then();
  }

  private reloadToIndex() {
    this.router.navigateByUrl('/').then(() => window.location.reload());
  }

  private reloadToLogin() {
    this.router.navigateByUrl('/login').then(() => window.location.reload());
  }

  private reloadPageAfterEnvironmentChanged() {
    const { protocol, host, pathname } = window.location;

    let path = this.router.url.split('/').slice(0, 2);

    const match = pathname.match(/^\/(en|zh)\//);
    if (match) {
      path = [ match[1], ...path ].filter(x => x !== '');
    }

    window.location.href = `${protocol}//${host}/${path.join('/')}`;
  }
}
