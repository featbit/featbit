import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IProject, IProjectEnv } from '@shared/types';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";
import { MessageQueueService } from "@services/message-queue.service";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  baseUrl = `${environment.url}/api/v1/projects`;

  constructor(
    private http: HttpClient,
    private messageQueueService: MessageQueueService
  ) { }

  getList(): Observable<IProject[]> {
    return this.http.get<IProject[]>(this.baseUrl);
  }

  async getListAsync(): Promise<IProject[]> {
    return firstValueFrom(this.getList());
  }

  get(projectId: string): Observable<IProject> {
    const url =  `${this.baseUrl}/${projectId}`;
    return this.http.get<IProject>(url);
  }

  create(params): Observable<any> {
    return this.http.post(this.baseUrl, params);
  }

  update(id: string, params): Observable<any> {
    const url = `${this.baseUrl}/${id}`;
    return this.http.put(url, params);
  }

  delete(projectId: string): Observable<any> {
    const url = `${this.baseUrl}/${projectId}`;
    return this.http.delete(url);
  }

  // update or set current project env
  upsertCurrentProjectEnvLocally(project: IProjectEnv) {
    localStorage.setItem(CURRENT_PROJECT(), JSON.stringify(project));
    this.messageQueueService.emit(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED);
  }

  // reset current project env
  clearCurrentProjectEnv() {
    localStorage.removeItem(CURRENT_PROJECT());
  }
}
