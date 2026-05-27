import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IEnvironment } from '@shared/types';
import { catchError } from "rxjs/operators";
import { CreateEnvPayload, UpdateEnvPayload } from "@core/components/env-drawer/types";
import { getCurrentProjectEnv } from "@utils/project-env";

@Injectable({
  providedIn: 'root'
})
export class EnvService {
  get baseUrl(): string {
    const projectEnv = getCurrentProjectEnv();
    return `${environment.url}/api/v1/projects/${projectEnv.projectId}/envs`;
  }

  constructor(private http: HttpClient) { }

  getEnv(envId: string): Observable<IEnvironment> {
    const url = `${this.baseUrl}/${envId}`;
    return this.http.get<IEnvironment>(url);
  }

  createEnv(payload: CreateEnvPayload): Observable<IEnvironment> {
    return this.http.post<IEnvironment>(this.baseUrl, payload);
  }

  updateEnv(envId: string, payload: UpdateEnvPayload): Observable<IEnvironment> {
    const url = `${this.baseUrl}/${envId}`;
    return this.http.put<IEnvironment>(url, payload);
  }

  removeEnv(envId: string): Observable<boolean> {
    const url = `${this.baseUrl}/${envId}`;
    return this.http.delete<boolean>(url);
  }

  isKeyUsed(key: string): Observable<boolean> {
    const url = `${this.baseUrl}/is-key-used?key=${key}`;
    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }
}
