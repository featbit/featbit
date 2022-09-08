import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from 'src/environments/environment';
import { getCurrentProjectEnv } from "@utils/project-env";

@Injectable({
  providedIn: 'root'
})
export class DataSyncService {

  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return `${environment.url}/api/datasync/envs/${envId}`;
  }

  constructor(private http: HttpClient) { }

  uploadUrl(): string {
    return `${this.baseUrl}/upload`;
  }

  download(): Observable<any> {
    return this.http.get(`${this.baseUrl}/download`);
  }

  syncToRemote(settingId: string): Observable<string> {
    return this.http.put(`${this.baseUrl}/sync-to-remote?settingId=${settingId}`, { }, { responseType: 'text' });
  }
}
