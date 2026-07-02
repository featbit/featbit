import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { getCurrentOrganization, getCurrentProjectEnv } from '@utils/project-env';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {
  EnvUserFilter,
  EnvUserPagedResult,
  EnvUserSearchFilter
} from "@features/safe/end-users/types/featureflag-user";
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
import { FlagSortedBy } from "@features/safe/workspaces/types/organization";

@Injectable({
  providedIn: 'root'
})
export class EnvUserService {
  constructor(private http: HttpClient) {
  }

  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return `${environment.url}/api/v1/envs/${envId}/end-users`;
  }

  uploadUrl(): string {
    return `${this.baseUrl}/upload`;
  }

  get(id: string): Observable<IUserType> {
    const url = `${this.baseUrl}/${id}`;

    return this.http.get<IUserType>(url);
  }

  // get users by key ids
  public getByKeyIds(keyIds: string[]): Observable<any> {
    const url = `${this.baseUrl}/by-keyIds`;
    return this.http.post(url, keyIds);
  }

  // upsert users
  public upsert(params): Observable<any> {
    return this.http.put(this.baseUrl, { ...params });
  }

  getList(filter: EnvUserFilter = new EnvUserFilter()): Observable<EnvUserPagedResult> {
    const url = `${this.baseUrl}/list`;
    return this.http.post<EnvUserPagedResult>(url, filter);
  }

  search(filter: EnvUserSearchFilter = new EnvUserSearchFilter()): Observable<IUserType[]> {
    const url = `${this.baseUrl}/search`;
    return this.http.post<IUserType[]>(url, filter);
  }

  getFlags(id: string, filter: EndUserFlagFilter = new EndUserFlagFilter()): Observable<IPagedEndUserFlag> {
    const org = getCurrentOrganization();

    const queryParam = {
      name: filter.searchText ?? '',
      sortBy: org.settings?.flagSortedBy ?? FlagSortedBy.CreatedAt,
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

  download(filter: EnvUserFilter = new EnvUserFilter()): Observable<any> {
    const url = `${this.baseUrl}/download`;
    return this.http.post<any>(url, filter);
  }
}
