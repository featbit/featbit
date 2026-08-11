import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { environment } from 'src/environments/environment';
import { ISecret } from "@shared/types";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class EnvSecretService {
  baseUrl = `${environment.url}/api/v1/envs/#envId/secrets`;

  constructor(private http: HttpClient) { }

  add(envId: string, name: string, type: string): Observable<ISecret> {
    const url = this.baseUrl.replace(/#envId/ig, `${envId}`);
    return this.http.post<ISecret>(url, { name, type });
  }

  delete(envId: string, secretId: string): Observable<boolean> {
    const url = this.baseUrl.replace(/#envId/ig, `${envId}`) + `/${secretId}`;
    return this.http.delete<boolean>(url);
  }

  update(envId: string, secretId: string, name: string): Observable<boolean> {
    const url = this.baseUrl.replace(/#envId/ig, `${envId}`) + `/${secretId}`;
    return this.http.put<boolean>(url, { name });
  }
}
