import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from 'src/environments/environment';
import { getCurrentProjectEnv } from "@utils/project-env";
import { EnvironmentSetting } from "@shared/types";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class EnvSettingService {
  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return `${environment.url}/api/v1/envs/${envId}/settings`
  }

  constructor(private http: HttpClient) { }

  get(type: string): Observable<EnvironmentSetting[]> {
    return this.http.get<EnvironmentSetting[]>(this.baseUrl, { params: { type }});
  }

  upsert(settings: EnvironmentSetting[]): Observable<EnvironmentSetting[]> {
    return this.http.put<EnvironmentSetting[]>(this.baseUrl, { settings });
  }

  delete(settingId: string): Observable<EnvironmentSetting[]> {
    return this.http.delete<EnvironmentSetting[]>(this.baseUrl + '/' + settingId);
  }
}
