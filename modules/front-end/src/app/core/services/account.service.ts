import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IAccount, IProjectEnv, IAccountProjectEnv } from '@shared/types';
import { ProjectService } from './project.service';
import { CURRENT_ACCOUNT, CURRENT_PROJECT } from "@utils/localstorage-keys";

@Injectable({
  providedIn: 'root'
})
export class AccountService {
  baseUrl = `${environment.url}/api/v2/accounts`;
  accounts: IAccount[] = [];

  constructor(
    private http: HttpClient,
    private projectService: ProjectService
  ) { }

  // 获取 account 列表
  getAccounts(): Observable<any> {
    const url = this.baseUrl;
    return this.http.get(url);
  }

// 创建 account
  postCreateAccount(params: any): Observable<any> {
    const url = this.baseUrl;
    return this.http.post(url, params);
  }

  // 更新 account
  putUpdateAccount(params: any): Observable<any> {
    const url = this.baseUrl;
    return this.http.put(url, params);
  }

  initialize(id: any, params: any): Observable<any> {
    const url = `${this.baseUrl}/${id}/initialize`;
    return this.http.post(url, params);
  }

  changeAccount(account: IAccount) {
    if (!!account) {
      localStorage.setItem(CURRENT_ACCOUNT(), JSON.stringify(account));
      const currentAccount = this.accounts.find(ws => ws.id == account.id);
      currentAccount.organizationName = account.organizationName;
    } else {
      localStorage.setItem(CURRENT_ACCOUNT(), '');
    }

    this.projectService.clearCurrentProjectEnv();
    window.location.reload();
  }

  setAccount(account: IAccount) {
    if (!!account) {
      localStorage.setItem(CURRENT_ACCOUNT(), JSON.stringify(account));
      const currentAccount = this.accounts.find(ws => ws.id == account.id);
      currentAccount.organizationName = account.organizationName;
    } else {
      localStorage.setItem(CURRENT_ACCOUNT(), '');
    }
  }

  getCurrentAccount(): Observable<IAccount> {
    return new Observable(observer => {
      const accountStr = localStorage.getItem(CURRENT_ACCOUNT());
      if (this.accounts.length === 0 || !accountStr || JSON.parse(accountStr)?.plan === undefined) {
        this.getAccounts().subscribe(res => {
          this.accounts = res as IAccount[];
          if (!accountStr || JSON.parse(accountStr)?.plan === undefined) {
            const currentAcount = this.accounts[0];
            localStorage.setItem(CURRENT_ACCOUNT(), JSON.stringify(currentAcount));
            observer.next(currentAcount);
          } else {
            observer.next(this.accounts.find(ws => ws.id == JSON.parse(accountStr).id));
          }
        });
      } else {
        observer.next(this.accounts.find(ws => ws.id == JSON.parse(accountStr).id));
      }
    });
  }

  getCurrentAccountProjectEnv(): IAccountProjectEnv {
    const account: IAccount = JSON.parse(localStorage.getItem(CURRENT_ACCOUNT())!);
    const projectEnv: IProjectEnv = JSON.parse(localStorage.getItem(CURRENT_PROJECT())!);
    return {
      account,
      projectEnv
    };
  }
}
