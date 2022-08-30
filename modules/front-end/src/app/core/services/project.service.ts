import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IProject, IProjectEnv } from '@shared/types';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  currentProjectEnvChanged$: Subject<void> = new Subject<void>();
  projectListChanged$: Subject<void> = new Subject<void>();

  baseUrl = `${environment.url}/api/v2/accounts/#accountId/projects`;


  constructor(private http: HttpClient) { }

  // 获取 project 列表
  public getProjects(accountId: number): Observable<IProject[]> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`);
    return this.http.get<IProject[]>(url);
  }

  getProject(accountId: number, projectId: number): Observable<IProject> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`) + `/${projectId}`;
    return this.http.get<IProject>(url);
  }

  // 创建 project
  postCreateProject(accountId: number, params): Observable<any> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`);
    return this.http.post(url, params);
  }

  // 更新 project
  putUpdateProject(accountId: number, params): Observable<any> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`);
    return this.http.put(url, params);
  }

  // 删除 project
  removeProject(accountId: number, projectId: number): Observable<any> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`) + `/${projectId}`;
    return this.http.delete(url);
  }

  // update or set current project env
  upsertCurrentProjectEnvLocally(project: IProjectEnv) {
    localStorage.setItem(CURRENT_PROJECT(), JSON.stringify(project));
    this.currentProjectEnvChanged$.next();
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
  getCurrentProjectEnv(accountId: number): Observable<IProjectEnv> {
    return new Observable(observer => {
      const localCurrentProjectEnv = this.getLocalCurrentProjectEnv();
      if (localCurrentProjectEnv) {
        observer.next(localCurrentProjectEnv);
      } else {
        this.getProjects(accountId).subscribe(projects => {
          // chose first project first env as default value
          const firstProject = projects[0];
          const firstProjectEnv = firstProject.environments[0];

          const projectEnv: IProjectEnv = {
            projectId: firstProject.id,
            projectName: firstProject.name,
            envId: firstProjectEnv.id,
            envName: firstProjectEnv.name,
            envSecret: firstProjectEnv.secret
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
