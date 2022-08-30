import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import {
  CURRENT_ACCOUNT,
  CURRENT_PROJECT,
  IDENTITY_TOKEN,
  LOGIN_REDIRECT_URL,
  USER_PROFILE
} from "@utils/localstorage-keys";
import { Router } from "@angular/router";
import { AccountService } from '@services/account.service';

@Injectable({
  providedIn: 'root'
})
export class UserService {

  baseUrl: string = `${environment.url}/api/v2/user`

  constructor(
    private http: HttpClient,
    private router: Router,
    private accountService: AccountService
  ) { }

  registerByEmail(email: string, password: string) {
    return this.http.post(`${this.baseUrl}/register-by-email`, { email, password });
  }

  registerByPhone(phoneNumber: string, code: string, password: string) {
    return this.http.post(`${this.baseUrl}/register-by-phone`, { phoneNumber, code, password });
  }

  loginByPassword(identity: string, password: string) {
    return this.http.post(`${this.baseUrl}/login-by-password`, { identity, password });
  }

  loginByPhoneCode(phoneNumber: string, code: string) {
    return this.http.post(`${this.baseUrl}/login-by-phone-code`, { phoneNumber, code });
  }

  resetPassword(identity: string, code: string, newPassword: string) {
    return this.http.post(`${this.baseUrl}/reset-password`, { identity, code, newPassword });
  }

  checkIdentityExists(identity: string) {
    return this.http.get(`${this.baseUrl}/check-identity-exists?identity=${identity}`);
  }

  sendIdentityCode(identity: string, scene: string) {
    return this.http.get(`${this.baseUrl}/send-identity-code`, { params: { identity, scene } });
  }

  getProfile() {
    return this.http.get(`${this.baseUrl}/user-profile`);
  }

  updateProfile(userName: string) {
    return this.http.put(`${this.baseUrl}/user-profile`, { userName });
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
      this.getProfile().subscribe(profile => {
        localStorage.setItem(USER_PROFILE, JSON.stringify(profile));
        this.accountService.getCurrentAccount().subscribe(() => {
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
    };

    localStorage.clear();
    Object.keys(storageToKeep).forEach(k => localStorage.setItem(k, storageToKeep[k]))
    this.router.navigateByUrl('/login').then();
  }
}
