import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IEnvironment, IEnvKey, ISecret } from '@shared/types';

@Injectable({
  providedIn: 'root'
})
export class EnvSecretService {
  baseUrl = `${environment.url}/api/v1/envs/#envId/secrets`;

  constructor(private http: HttpClient) { }

  addSecret(envId: string, secret: ISecret): Observable<any> {
    const url = this.baseUrl.replace(/#envId/ig, `${envId}`);
    return this.http.post<ISecret>(url, secret);
  }

  removeSecret(envId: string, secretId: string): Observable<any> {
    const url = this.baseUrl.replace(/#envId/ig, `${envId}`) + `/${secretId}`;
    return this.http.delete(url);
  }

  updateSecretName(envId: string, secretId: string, secretName: string) {
    const url = this.baseUrl.replace(/#envId/ig, `${envId}`) + `/${secretId}`;
    return this.http.put<ISecret>(url, { name: secretName });
  }
}
