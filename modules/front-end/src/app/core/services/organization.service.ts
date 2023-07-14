import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IOrganization } from '@shared/types';
import { ProjectService } from './project.service';
import { CURRENT_ORGANIZATION } from "@utils/localstorage-keys";

@Injectable({
  providedIn: 'root'
})
export class OrganizationService {
  baseUrl = `${environment.url}/api/v1/organizations`;
  organizations: IOrganization[] = [];

  constructor(
    private http: HttpClient,
    private projectService: ProjectService
  ) { }

  getList(): Observable<any> {
    const url = this.baseUrl;
    return this.http.get(url);
  }

  create(params: any): Observable<any> {
    const url = this.baseUrl;
    return this.http.post(url, params);
  }

  update(params: any): Observable<any> {
    return this.http.put(this.baseUrl, params);
  }

  addUser(params: any): Observable<any> {
    const url = `${this.baseUrl}/add-user`;
    return this.http.post<boolean>(url, params);
  }

  onboarding(params: any): Observable<any> {
    const url = `${this.baseUrl}/onboarding`;
    return this.http.post(url, params);
  }

  switchOrganization(account: IOrganization) {
    if (!!account) {
      localStorage.setItem(CURRENT_ORGANIZATION(), JSON.stringify(account));
      const currentAccount = this.organizations.find(ws => ws.id == account.id);
      currentAccount.name = account.name;
    } else {
      localStorage.setItem(CURRENT_ORGANIZATION(), '');
    }

    this.projectService.clearCurrentProjectEnv();
    window.location.reload();
  }

  setOrganization(organization: IOrganization) {
    if (!!organization) {
      localStorage.setItem(CURRENT_ORGANIZATION(), JSON.stringify(organization));
      const currentAccount = this.organizations.find(ws => ws.id == organization.id);
      currentAccount.name = organization.name;
    } else {
      localStorage.setItem(CURRENT_ORGANIZATION(), '');
    }
  }

  getCurrentOrganization(): Observable<IOrganization> {
    return new Observable(observer => {
      const orgStr = localStorage.getItem(CURRENT_ORGANIZATION());
      if (this.organizations.length === 0 || !orgStr || JSON.parse(orgStr)?.plan === undefined) {
        this.getList().subscribe(res => {
          this.organizations = res as IOrganization[];
          if (!orgStr) {
            const currentOrg = this.organizations[0];
            localStorage.setItem(CURRENT_ORGANIZATION(), JSON.stringify(currentOrg));
            observer.next(currentOrg);
          } else {
            observer.next(this.organizations.find(ws => ws.id == JSON.parse(orgStr).id));
          }
        });
      } else {
        observer.next(this.organizations.find(ws => ws.id == JSON.parse(orgStr).id));
      }
    });
  }
}
