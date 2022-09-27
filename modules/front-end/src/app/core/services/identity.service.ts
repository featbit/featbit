import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import {
  CURRENT_ACCOUNT, CURRENT_LANGUAGE,
  CURRENT_PROJECT,
  IDENTITY_TOKEN,
  LOGIN_REDIRECT_URL,
  USER_PROFILE
} from "@utils/localstorage-keys";
import { Router } from "@angular/router";
import { OrganizationService } from '@services/organization.service';
import {UserService} from "@services/user.service";
import {IResponse} from "@shared/types";

@Injectable({
  providedIn: 'root'
})
export class IdentityService {

  baseUrl: string = `${environment.url}/api/v1/identity`

  constructor(
    private http: HttpClient,
    private router: Router,
    private accountService: OrganizationService,
    private userService: UserService
  ) { }

  loginByEmail(email: string, password: string) {
    return this.http.post(`${this.baseUrl}/login-by-email`, { email, password });
  }

  async doLoginUser(token: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (!token) {
        resolve();
        return;
      }

      // store identity token
      localStorage.setItem(IDENTITY_TOKEN, token);

      // store user profile
      this.userService.getProfile().subscribe((profile: IResponse) => {
        localStorage.setItem(USER_PROFILE, JSON.stringify(profile));
        this.accountService.getCurrentOrganization().subscribe(() => {
          resolve();
          const redirectUrl = localStorage.getItem(LOGIN_REDIRECT_URL);
          if (redirectUrl) {
            localStorage.removeItem(LOGIN_REDIRECT_URL);
            this.router.navigateByUrl(redirectUrl);
          } else {
            this.router.navigateByUrl('/');
          }
        }, () => resolve());
      }, () => resolve());
    });
  }

  async doLogoutUser() {
    const storageToKeep = {
      // restore account and project, so when user login, he would always see the same project & env
      [CURRENT_ACCOUNT()]: localStorage.getItem(CURRENT_ACCOUNT()),
      [CURRENT_PROJECT()]: localStorage.getItem(CURRENT_PROJECT()),
      [CURRENT_LANGUAGE()]: localStorage.getItem(CURRENT_LANGUAGE()),
    };

    localStorage.clear();
    Object.keys(storageToKeep).forEach(k => localStorage.setItem(k, storageToKeep[k]))
    this.router.navigateByUrl('/login').then();
  }
}
