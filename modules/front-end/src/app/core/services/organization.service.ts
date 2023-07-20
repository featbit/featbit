import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IOnboarding, IOrganization } from '@shared/types';
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

  async getListAsync(): Promise<IOrganization[]> {
    return firstValueFrom(this.http.get<IOrganization[]>(this.baseUrl));
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

  onboarding(payload: IOnboarding): Observable<any> {
    const url = `${this.baseUrl}/onboarding`;
    return this.http.post(url, payload);
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
      const currentAccount = this.organizations.find(ws => ws.id == organization.id);
      currentAccount.name = organization.name;
      localStorage.setItem(CURRENT_ORGANIZATION(), JSON.stringify(currentAccount));
    } else {
      localStorage.setItem(CURRENT_ORGANIZATION(), '');
    }
  }

  async setUserOrganizations(): Promise<IOrganization> {
    const orgStr = localStorage.getItem(CURRENT_ORGANIZATION());
    this.organizations = await this.getListAsync();
    const currentOrg = !orgStr ? this.organizations[0] : this.organizations.find(ws => ws.id === JSON.parse(orgStr).id);
    this.setOrganization(currentOrg);
    return currentOrg;
  }
}
