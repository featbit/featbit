import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IProject, IProjectEnv } from '@shared/types';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";
import { MessageQueueService } from "@services/message-queue.service";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  baseUrl = `${environment.url}/api/v1/projects`;

  constructor(private http: HttpClient, private messageQueueService: MessageQueueService,) { }

  getList(): Observable<IProject[]> {
    return this.http.get<IProject[]>(this.baseUrl);
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

  // get local project env
  getLocalCurrentProjectEnv(): IProjectEnv {
    const projectEnvJson = localStorage.getItem(CURRENT_PROJECT());
    return projectEnvJson ? JSON.parse(projectEnvJson) : undefined;
  }

  // get current project env for account
  getCurrentProjectEnv(): Observable<IProjectEnv> {
    return new Observable(observer => {
      const localCurrentProjectEnv = this.getLocalCurrentProjectEnv();
      if (localCurrentProjectEnv) {
        observer.next(localCurrentProjectEnv);
      } else {
        this.getList().subscribe(projects => {
          // chose first project first env as default value
          const firstProject = projects[0];
          const firstProjectEnv = firstProject.environments[0];

          const projectEnv: IProjectEnv = {
            projectId: firstProject.id,
            projectName: firstProject.name,
            envId: firstProjectEnv.id,
            envKey: firstProjectEnv.key,
            envName: firstProjectEnv.name,
            envSecret: firstProjectEnv.secrets[0].value
          };

          this.upsertCurrentProjectEnvLocally(projectEnv);
          observer.next(projectEnv);
        });
      }
    })
  };

  // reset current project env
  clearCurrentProjectEnv() {
    localStorage.removeItem(CURRENT_PROJECT());
  }
}
