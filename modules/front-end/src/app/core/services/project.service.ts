import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IProject, IProjectEnv } from '@shared/types';
import { CURRENT_PROJECT } from "@utils/localstorage-keys";
import { MessageQueueService } from "@services/message-queue.service";
import { getCurrentProjectEnv } from "@utils/project-env";
import { PermissionsService } from "@services/permissions.service";
import { permissionActions } from "@shared/policy";

@Injectable({
  providedIn: 'root'
})
export class ProjectService {
  baseUrl = `${environment.url}/api/v1/projects`;

  constructor(
    private http: HttpClient,
    private messageQueueService: MessageQueueService,
    private permissionsService: PermissionsService) { }

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

  setCurrentProjectEnv(): Promise<IProjectEnv> {
    return new Promise((resolve, reject) => {
      this.getList().subscribe({
        error: () => resolve(null),
        next: (projects) => {
          const localCurrentProjectEnv = getCurrentProjectEnv();
          let project, env;
          let canAccessEnv = false;

          if (localCurrentProjectEnv) {
            project = projects.find(pro => pro.id === localCurrentProjectEnv.projectId);
            env = project.environments.find(env => env.id === localCurrentProjectEnv.envId);

            canAccessEnv = this.permissionsService.isGranted(`project/${project.name}:env/${env.name}`, permissionActions.AccessEnvs);
          }{

            if (!canAccessEnv)
            for (let p of projects) {
              env = p.environments.find((e) => this.permissionsService.isGranted(`project/${p.name}:env/${e.name}`, permissionActions.AccessEnvs));

              if (env) {
                canAccessEnv = true;
                project = p;

                break;
              }
            }
          }

          let projectEnv: IProjectEnv = null;

          if (canAccessEnv) {
            projectEnv = {
              projectId: project.id,
              projectName: project.name,
              envId: env.id,
              envKey: env.key,
              envName: env.name,
              envSecret: env.secrets[0].value
            };

            this.upsertCurrentProjectEnvLocally(projectEnv);
          }


          resolve(projectEnv);
        }
      })
    });
  };

  // reset current project env
  clearCurrentProjectEnv() {
    localStorage.removeItem(CURRENT_PROJECT());
  }
}
