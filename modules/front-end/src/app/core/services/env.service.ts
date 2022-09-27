import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IEnvironment, IEnvKey } from '@shared/types';

@Injectable({
  providedIn: 'root'
})
export class EnvService {
  baseUrl = `${environment.url}/api/v1/accounts/#accountId/projects/#projectId/envs`;
  envs: IEnvironment[] = [];

  constructor(private http: HttpClient) { }

  // 获取 env 列表
  public getEnvs(accountId: number, projectId: number): Observable<IEnvironment[]> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`).replace(/#projectId/ig, `${projectId}`);
    return this.http.get<IEnvironment[]>(url);
  }

  // 创建 env
  postCreateEnv(accountId: number, projectId: number, params): Observable<any> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`).replace(/#projectId/ig, `${projectId}`);
    return this.http.post(url, params);
  }

  // 更新 env
  putUpdateEnv(accountId: number, projectId: number, params): Observable<any> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`).replace(/#projectId/ig, `${projectId}`);
    return this.http.put(url, params);
  }

  // 重新生成 env secret
  putUpdateEnvKey(accountId: number, projectId: number, envId: number, params: IEnvKey): Observable<IEnvKey> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`).replace(/#projectId/ig, `${projectId}`) + `/${envId}/key`;
    return this.http.put<IEnvKey>(url, params);
  }

  // 删除 env
  removeEnv(accountId: number, projectId: number, envId: number): Observable<any> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`).replace(/#projectId/ig, `${projectId}`) + `/${envId}`;
    return this.http.delete(url);
  }
}
