import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IEnvironment, IEnvKey, ISecret } from '@shared/types';

@Injectable({
  providedIn: 'root'
})
export class EnvService {
  baseUrl = `${environment.url}/api/v1/projects/#projectId/envs`;
  envs: IEnvironment[] = [];

  constructor(private http: HttpClient) { }

  public getEnvs(projectId: string): Observable<IEnvironment[]> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`);
    return this.http.get<IEnvironment[]>(url);
  }

  postCreateEnv(projectId: string, params): Observable<any> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`);
    return this.http.post(url, params);
  }

  putUpdateEnv(projectId: string, params): Observable<any> {
    const url = `${this.baseUrl.replace(/#projectId/ig, `${projectId}`)}/${params.id}`;
    return this.http.put(url, params);
  }

  putUpdateEnvKey(projectId: string, envId: string, params: IEnvKey): Observable<IEnvKey> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`) + `/${envId}/key`;
    return this.http.put<IEnvKey>(url, params);
  }

  removeEnv(projectId: string, envId: string): Observable<any> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`) + `/${envId}`;
    return this.http.delete(url);
  }

  addSecret(projectId: string, envId: string, secret: ISecret): Observable<any> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`) + `/${envId}/secrets`;
    return this.http.post<ISecret>(url, secret);
  }

  removeSecret(projectId: string, envId: string, secretId: string): Observable<any> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`) + `/${envId}/secrets/${secretId}`;
    return this.http.delete(url);
  }

  updateSecretName(projectId: string, envId: string, secretId: string, secretName: string) {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`) + `/${envId}/secrets/${secretId}`;
    return this.http.put<ISecret>(url, { name: secretName });
  }
}
