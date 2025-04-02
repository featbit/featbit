import { Injectable } from "@angular/core";
import { Router } from "@angular/router";

@Injectable({
  providedIn: 'root',
})

export class BroadcastService {
  private channel = new BroadcastChannel('featbit-ui-broadcast-channel');

  constructor(private router: Router) {
  }

  private _initialized = false;

  init() {
    if (this._initialized) {
      return;
    }

    this.channel.onmessage = (event) => {
      switch (event.data) {
        case 'env-changed':
          this.reloadPageAfterEnvironmentChanged();
          break;

        case 'user-logged-in':
          this.navigateToIndex();
          break;

        case 'user-logged-out':
        case 'org-changed':
          this.navigateToLogin();
          break;
      }
    }

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
    this.navigateToLogin();
  }

  private navigateToIndex() {
    this.router.navigateByUrl('/').then();
  }

  private navigateToLogin() {
    this.router.navigateByUrl('/login').then();
  }

  private reloadPageAfterEnvironmentChanged() {
    const { protocol, host, pathname } = window.location;

    let path = this.router.url.split('/').slice(0, 2);

    const match = pathname.match(/^\/(en|zh)\//);
    if (match) {
      path = [ match[1], ...path ].filter(x => x !== '');
    }

    window.location.href = `${protocol}//${host}${path.join('/')}`;
  }
}
