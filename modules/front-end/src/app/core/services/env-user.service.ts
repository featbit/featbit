import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getCurrentProjectEnv } from '@utils/project-env';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { EnvUserFilter, EnvUserPagedResult } from "@features/safe/end-users/types/featureflag-user";
import { IUserType } from "@shared/types";
import {
  EndUserFlagFilter,
  IEndUserSegment,
  IPagedEndUserFlag
} from "@features/safe/end-users/types/user-segments-flags";
import {
  IFeatureFlagEndUserFilter,
  IFeatureFlagEndUserPagedResult
} from "@features/safe/feature-flags/details/insights/types";

@Injectable({
  providedIn: 'root'
})
export class EnvUserService {
  public envId: string = null;

  constructor(private http: HttpClient) {
    this.envId = getCurrentProjectEnv().envId;
  }

  get baseUrl() {
    return `${environment.url}/api/v1/envs/${this.envId}/end-users`;
  }

  get(id: string): Observable<IUserType> {
    const url = `${this.baseUrl}/${id}`;

    return this.http.get<IUserType>(url);
  }

  // get users by key ids
  public getUsersByKeyIds(keyIds: string[]): Observable<any> {
    const url = `${this.baseUrl}/by-keyIds`;
    return this.http.get(url, {params: new HttpParams({fromObject: { keyIds }})});
  }

  // upsert users
  public upsert(params): Observable<any> {
    return this.http.put(this.baseUrl, { ...params });
  }

  search(filter: EnvUserFilter = new EnvUserFilter()): Observable<EnvUserPagedResult> {
    const queryParam = {
      searchText: filter.searchText ?? '',
      properties: filter.properties || [],
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<EnvUserPagedResult>(this.baseUrl, {params: new HttpParams({fromObject: queryParam})});
  }

  getFlags(id: string, filter: EndUserFlagFilter = new EndUserFlagFilter()): Observable<IPagedEndUserFlag> {
    const queryParam = {
      searchText: filter.searchText ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    const url = `${this.baseUrl}/${id}/flags`;

    return this.http.get<IPagedEndUserFlag>(url, {params: new HttpParams({fromObject: queryParam})});
  }

  getSegments(id: string): Observable<IEndUserSegment[]> {
    const url = `${this.baseUrl}/${id}/segments`;

    return this.http.get<IEndUserSegment[]>(url);
  }

  searchByFlag(filter: IFeatureFlagEndUserFilter): Observable<IFeatureFlagEndUserPagedResult> {
    const queryParam = {
      query: filter.query ?? '',
      featureFlagKey: filter.featureFlagKey,
      variationId: filter.variationId ?? '',
      from: filter.from,
      to: filter.to,
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    const url = `${this.baseUrl}/get-by-featureflag`;

    return this.http.get<IFeatureFlagEndUserPagedResult>(url, {params: new HttpParams({fromObject: queryParam})});
  }
}
