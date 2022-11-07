import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getCurrentProjectEnv } from '@utils/project-env';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { EnvUserFilter, EnvUserPagedResult } from "@features/safe/end-users/types/featureflag-user";
import { IUserType } from "@shared/types";
import { IJsonContent } from "@features/safe/feature-flags/types/switch-new";
import {
  EndUserFlagFilter,
  IEndUserSegment,
  IPagedEndUserFlag
} from "@features/safe/end-users/types/user-segments-flags";

@Injectable({
  providedIn: 'root'
})
export class EnvUserService {
  public envId: string = null;

  constructor(private http: HttpClient) {
    this.envId = getCurrentProjectEnv().envId;
  }

  get baseUrl() {
    return environment.url;
  }

  get(id: string): Observable<IUserType> {
    const url = this.baseUrl + `/api/v1/envs/${this.envId}/end-users/${id}`;

    return this.http.get<IUserType>(url);
  }

  // get users by key ids
  public getUsersByKeyIds(keyIds: string[]): Observable<any> {
    const url = this.baseUrl + `/api/v1/envs/${this.envId}/end-users/by-keyIds`;
    return this.http.get(url, {params: new HttpParams({fromObject: { keyIds }})});
  }

  // upsert users
  public upsert(params): Observable<any> {
    const url = this.baseUrl + `/api/v1/envs/${this.envId}/end-users`;
    return this.http.put(url, { ...params });
  }

  search(filter: EnvUserFilter = new EnvUserFilter()): Observable<EnvUserPagedResult> {
    const queryParam = {
      searchText: filter.searchText ?? '',
      properties: filter.properties || [],
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    const url = this.baseUrl + `/api/v1/envs/${this.envId}/end-users`;
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

    const url = this.baseUrl + `/api/v1/envs/${this.envId}/end-users/rest-search`;
    return this.http.get<EnvUserPagedResult>(url, { params: params });
  }

  getFlags(id: string, filter: EndUserFlagFilter = new EndUserFlagFilter()): Observable<IPagedEndUserFlag> {
    const queryParam = {
      searchText: filter.searchText ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    const url = `${this.baseUrl}/api/v1/envs/${this.envId}/end-users/${id}/flags`;

    return this.http.get<IPagedEndUserFlag>(url, {params: new HttpParams({fromObject: queryParam})});
  }

  getSegments(id: string): Observable<IEndUserSegment[]> {
    const url = `${this.baseUrl}/api/v1/envs/${this.envId}/end-users/${id}/segments`;

    return this.http.get<IEndUserSegment[]>(url);
  }
}
