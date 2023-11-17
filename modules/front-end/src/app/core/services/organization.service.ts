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

  async getListAsync(isSsoFirstLogin: boolean = false): Promise<IOrganization[]> {
    return firstValueFrom(this.http.get<IOrganization[]>(`${this.baseUrl}?isSsoFirstLogin=${isSsoFirstLogin}`));
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

  switchOrganization(org: IOrganization) {
    if (!!org) {
      localStorage.setItem(CURRENT_ORGANIZATION(), JSON.stringify(org));
      const currentOrganization = this.organizations.find(ws => ws.id == org.id);
      currentOrganization.name = org.name;
    } else {
      localStorage.setItem(CURRENT_ORGANIZATION(), '');
    }

    this.projectService.clearCurrentProjectEnv();
  }

  setOrganization(organization: IOrganization) {
    if (!!organization) {
      const currentOrganization = this.organizations.find(ws => ws.id == organization.id);
      currentOrganization.name = organization.name;
      currentOrganization.initialized = organization.initialized;
      localStorage.setItem(CURRENT_ORGANIZATION(), JSON.stringify(currentOrganization));
    } else {
      localStorage.setItem(CURRENT_ORGANIZATION(), '');
    }
  }
}
