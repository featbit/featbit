import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IEnvironment, IEnvKey } from '@shared/types';

@Injectable({
  providedIn: 'root'
})
export class EnvService {
  baseUrl = `${environment.url}/api/v1/organizations/#organizationId/projects/#projectId/envs`;
  envs: IEnvironment[] = [];

  constructor(private http: HttpClient) { }

  public getEnvs(organizationId: number, projectId: number): Observable<IEnvironment[]> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`).replace(/#projectId/ig, `${projectId}`);
    return this.http.get<IEnvironment[]>(url);
  }

  postCreateEnv(organizationId: number, projectId: number, params): Observable<any> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`).replace(/#projectId/ig, `${projectId}`);
    return this.http.post(url, params);
  }

  putUpdateEnv(organizationId: number, projectId: number, params): Observable<any> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`).replace(/#projectId/ig, `${projectId}`);
    return this.http.put(url, params);
  }

  putUpdateEnvKey(organizationId: number, projectId: number, envId: number, params: IEnvKey): Observable<IEnvKey> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`).replace(/#projectId/ig, `${projectId}`) + `/${envId}/key`;
    return this.http.put<IEnvKey>(url, params);
  }

  removeEnv(organizationId: number, projectId: number, envId: number): Observable<any> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`).replace(/#projectId/ig, `${projectId}`) + `/${envId}`;
    return this.http.delete(url);
  }
}
