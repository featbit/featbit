import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IProject, IProjectEnv } from '@shared/types';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";
import { MessageQueueService } from "@services/message-queue.service";
import { map } from "rxjs/operators";

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

  setCurrentProjectEnv(): Observable<IProjectEnv> {
    return this.getList().pipe(
      map((projects: IProject[]) => {
        const localCurrentProjectEnv = this.getLocalCurrentProjectEnv();
        let project, env;

        if (localCurrentProjectEnv) {
          project = projects.find((pro) => pro.id === localCurrentProjectEnv.projectId);
          env = project.environments.find((env) => env.id === localCurrentProjectEnv.envId);
        } else {
          project = projects[0];
          env = project.environments[0];
        }

        const projectEnv: IProjectEnv = {
          projectId: project.id,
          projectName: project.name,
          envId: env.id,
          envKey: env.key,
          envName: env.name,
          envSecret: env.secrets[0].value
        };

        this.upsertCurrentProjectEnvLocally(projectEnv);
        return projectEnv;
      })
    );
  };

  // reset current project env
  clearCurrentProjectEnv() {
    localStorage.removeItem(CURRENT_PROJECT());
  }
}
