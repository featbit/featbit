import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import {
  CURRENT_ORGANIZATION, CURRENT_LANGUAGE,
  CURRENT_PROJECT,
  IDENTITY_TOKEN,
  LOGIN_REDIRECT_URL,
  USER_PROFILE
} from "@utils/localstorage-keys";
import { Router } from "@angular/router";
import { OrganizationService } from '@services/organization.service';
import { UserService } from "@services/user.service";
import { IResponse } from "@shared/types";
import { Observable } from "rxjs";
import { IResetPasswordResult } from "@features/safe/organizations/types/profiles";

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

  resetPassword(currentPassword: string, newPassword: string): Observable<IResetPasswordResult> {
    return this.http.put<IResetPasswordResult>(`${this.baseUrl}/reset-password`, { currentPassword, newPassword })
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

  async doLogoutUser(keepOrgProject: boolean = true) {
    const storageToKeep = {
      [CURRENT_LANGUAGE()]: localStorage.getItem(CURRENT_LANGUAGE()),
    };

    if (keepOrgProject) {
      // restore account and project, so when user login, he would always see the same project & env
      storageToKeep[CURRENT_ORGANIZATION()] = localStorage.getItem(CURRENT_ORGANIZATION());
      storageToKeep[CURRENT_PROJECT()] = localStorage.getItem(CURRENT_PROJECT());
    }

    localStorage.clear();
    Object.keys(storageToKeep).forEach(k => localStorage.setItem(k, storageToKeep[k]))
    this.router.navigateByUrl('/login').then();
  }
}
