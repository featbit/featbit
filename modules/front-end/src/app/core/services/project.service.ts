import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IProject, IProjectEnv } from '@shared/types';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";
import {MessageQueueService} from "@services/message-queue.service";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  baseUrl = `${environment.url}/api/v1/organizations/#organizationId/projects`;


  constructor(private http: HttpClient, private messageQueueService: MessageQueueService,) { }

  // 获取 project 列表
  public getProjects(organizationId: string): Observable<IProject[]> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`);
    return this.http.get<IProject[]>(url);
  }

  getProject(organizationId: string, projectId: string): Observable<IProject> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`) + `/${projectId}`;
    return this.http.get<IProject>(url);
  }

  // 创建 project
  postCreateProject(organizationId: string, params): Observable<any> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`);
    return this.http.post(url, params);
  }

  // 更新 project
  putUpdateProject(organizationId: string, params): Observable<any> {
    const url = `${this.baseUrl.replace(/#organizationId/ig, `${organizationId}`)}/${params.id}`;
    return this.http.put(url, params);
  }

  // 删除 project
  removeProject(organizationId: string, projectId: string): Observable<any> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`) + `/${projectId}`;
    return this.http.delete(url);
  }

  // update or set current project env
  upsertCurrentProjectEnvLocally(project: IProjectEnv) {
    localStorage.setItem(CURRENT_PROJECT(), JSON.stringify(project));
    this.messageQueueService.emit(this.messageQueueService.topics.CURRENT_ORG_PROJECT_ENV_CHANGED);
  }

  // update current project env by partial object
  updateCurrentProjectEnvLocally(partialUpdated: Partial<IProjectEnv>) {
    const projectEnvJson = localStorage.getItem(CURRENT_PROJECT());
    if (!projectEnvJson) {
      return;
    }

    const projectEnv = JSON.parse(projectEnvJson);
    const updatedProject = Object.assign(projectEnv, partialUpdated);

    this.upsertCurrentProjectEnvLocally(updatedProject);
  }

  // get local project env
  getLocalCurrentProjectEnv(): IProjectEnv {
    const projectEnvJson = localStorage.getItem(CURRENT_PROJECT());
    return projectEnvJson ? JSON.parse(projectEnvJson) : undefined;
  }

  // get current project env for account
  getCurrentProjectEnv(orginzationId: string): Observable<IProjectEnv> {
    return new Observable(observer => {
      const localCurrentProjectEnv = this.getLocalCurrentProjectEnv();
      if (localCurrentProjectEnv) {
        observer.next(localCurrentProjectEnv);
      } else {
        this.getProjects(orginzationId).subscribe(projects => {
          // chose first project first env as default value
          const firstProject = projects[0];
          const firstProjectEnv = firstProject.environments[0];

          const projectEnv: IProjectEnv = {
            projectId: firstProject.id,
            projectName: firstProject.name,
            envId: firstProjectEnv.id,
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
