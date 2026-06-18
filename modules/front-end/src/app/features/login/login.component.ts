import { Component, OnInit } from '@angular/core';
import { IDENTITY_TOKEN } from "@utils/localstorage-keys";
import { Router } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { IdentityService } from "@services/identity.service";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: [ './login.component.less' ],
  standalone: false
})
export class LoginComponent implements OnInit {

  constructor(
    private router: Router,
    private identityService: IdentityService
  ) { }

  async ngOnInit() {
    const token = localStorage.getItem(IDENTITY_TOKEN);
    if (token) {
      try {
        const refreshed: any = await firstValueFrom(this.identityService.refreshToken());
        const nextToken = refreshed?.token;
        if (nextToken) {
          localStorage.setItem(IDENTITY_TOKEN, nextToken);
          await this.router.navigateByUrl('/');
          return;
        }
      } catch {
        // Stay on the login page when the refresh cookie is gone or rejected.
      }
      localStorage.removeItem(IDENTITY_TOKEN);
    }
  }
}
