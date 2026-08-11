import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IEnvironment } from '@shared/types';
import { catchError } from "rxjs/operators";
import { CreateEnvPayload, UpdateEnvPayload } from "@core/components/env-drawer/types";

@Injectable({
  providedIn: 'root'
})
export class EnvService {
  baseUrl = `${environment.url}/api/v1/projects/#projectId/envs`;

  constructor(private http: HttpClient) { }

  getEnv(projectId: string, envId: string): Observable<IEnvironment> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`) + `/${envId}`;
    return this.http.get<IEnvironment>(url);
  }

  createEnv(projectId: string, payload: CreateEnvPayload): Observable<IEnvironment> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`);
    return this.http.post<IEnvironment>(url, payload);
  }

  updateEnv(projectId: string, envId: string, payload: UpdateEnvPayload): Observable<IEnvironment> {
    const url = `${this.baseUrl.replace(/#projectId/ig, `${projectId}`)}/${envId}`;
    return this.http.put<IEnvironment>(url, payload);
  }

  removeEnv(projectId: string, envId: string): Observable<boolean> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`) + `/${envId}`;
    return this.http.delete<boolean>(url);
  }

  isKeyUsed(projectId: string, key: string): Observable<boolean> {
    const url = this.baseUrl.replace(/#projectId/ig, `${projectId}`) + `/is-key-used?key=${key}`;
    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }
}
