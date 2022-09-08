import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getCurrentProjectEnv } from '@utils/project-env';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { EnvUserFilter, EnvUserPagedResult } from "@features/safe/switch-user/types/featureflag-user";
import { IUserType } from "@shared/types";
import { IJsonContent } from "@features/safe/switch-manage/types/switch-new";

@Injectable({
  providedIn: 'root'
})
export class EnvUserService {
  public envId: number = null;

  constructor(private http: HttpClient) {
    this.envId = getCurrentProjectEnv().envId;
  }

  get baseUrl() {
    return environment.url;
  }

  get(id: string): Observable<IUserType> {
    const url = this.baseUrl + `/api/v2/envs/${this.envId}/users/${id}`;

    return this.http.get<IUserType>(url);
  }

  // get users by key ids
  public getUsersByKeyIds(keyIds: string[]): Observable<any> {
    const url = this.baseUrl + `/api/v2/envs/${this.envId}/users/byKeyIds`;
    return this.http.post(url, { keyIds });
  }

  // upsert users
  public upsert(params): Observable<any> {
    const url = this.baseUrl + `/api/v2/envs/${this.envId}/users`;
    return this.http.put(url, { ...params });
  }

  search(filter: EnvUserFilter = new EnvUserFilter()): Observable<EnvUserPagedResult> {
    const queryParam = {
      searchText: filter.searchText ?? '',
      properties: filter.properties || [],
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    const url = this.baseUrl + `/api/v2/envs/${this.envId}/users/search`;
    return this.http.get<EnvUserPagedResult>(url, {params: new HttpParams({fromObject: queryParam})});
  }

  targetedUsers(rules: IJsonContent[], pageIndex: number = 0, pageSize: number = 10): Observable<EnvUserPagedResult> {
    let filters: string[] = [];
    rules.forEach(rule => {
      let prop = rule.property;
      let op = rule.operation;

      // prop and op cannot be null or empty
      if (!prop || !op) {
        return;
      }

      let value = rule.type === 'multi'
        ? rule.multipleValue.join(',')
        : rule.value?.toString() ?? '';

      let filter = `${prop} ${op} '${value}'`;
      filters.push(filter);
    });

    let params = new HttpParams()
      .set('$filter', filters.join(' and '))
      .set('pageIndex', pageIndex)
      .set('pageSize', pageSize);

    const url = this.baseUrl + `/api/v2/envs/${this.envId}/users/rest-search`;
    return this.http.get<EnvUserPagedResult>(url, { params: params });
  }
}
