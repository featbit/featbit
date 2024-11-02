import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom, Observable, of } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IProject, IProjectEnv } from '@shared/types';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";
import { MessageQueueService } from "@services/message-queue.service";
import { catchError } from "rxjs/operators";
import { PermissionsService } from "@services/permissions.service";
import { permissionActions } from "@shared/policy";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  baseUrl = `${environment.url}/api/v1/projects`;

  constructor(
    private http: HttpClient,
    private permissionsService: PermissionsService,
    private messageQueueService: MessageQueueService
  ) { }

  async getListAsync(): Promise<IProject[]> {
    const projects = await firstValueFrom(this.http.get<IProject[]>(this.baseUrl));

    return projects.filter((project) => {
      const rn = this.permissionsService.getProjectRN(project);
      return this.permissionsService.isGranted(rn, permissionActions.CanAccessProject)
    }).map((project) => {
      project.environments = project.environments.filter((env) => {
        const envRN = this.permissionsService.getEnvRN(project, env);
        return !this.permissionsService.isDenied(envRN, permissionActions.CanAccessEnv);
      });

      return project;
    }).filter((project) => project.environments.length);
  }

  get(projectId: string): Observable<IProject> {
    const url = `${this.baseUrl}/${projectId}`;
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

  isKeyUsed(key: string): Observable<boolean> {
    const url = this.baseUrl + `/is-key-used?key=${key}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }
}
