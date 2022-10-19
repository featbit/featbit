﻿import { environment } from 'src/environments/environment';
import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of } from "rxjs";
import {
  IFeatureFlagListFilter,
  IFeatureFlagDropdown,
  IFeatureFlagListModel,
  IFeatureFlagDetail, ICopyToEnvResult
} from "@features/safe/feature-flags/types/switch-index";
import { getCurrentProjectEnv } from "@utils/project-env";
import { catchError } from "rxjs/operators";
import { IFfParams } from "@features/safe/feature-flags/types/switch-new";
import { encodeURIComponentFfc } from "@utils/index";

@Injectable({
  providedIn: 'root'
})
export class SwitchV2Service {

  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return `${environment.url}/api/v1/envs/${envId}/feature-flag`;
  }

  constructor(private http: HttpClient) { }

  getDetail(id: string): Observable<IFeatureFlagDetail> {
    return this.http.get<IFeatureFlagDetail>(`${this.baseUrl}/${id}/detail`);
  }

  getDropDown(): Observable<IFeatureFlagDropdown[]> {
    const url = `${this.baseUrl}/dropdown`;

    return this.http.get<IFeatureFlagDropdown[]>(url);
  }

  getListForUser(filter: IFeatureFlagListFilter = new IFeatureFlagListFilter()): Observable<IFeatureFlagListModel> {
    const queryParam = {
      name: filter.name ?? '',
      isEnabled: filter.isEnabled,
      tagIds: filter.tagIds ?? [],
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IFeatureFlagListModel>(
      `${this.baseUrl}/${filter.userKeyId}`,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  delete(id: string): Observable<boolean> {
    const url = `${this.baseUrl}/${encodeURIComponentFfc(id)}`;

    return this.http.delete<boolean>(url);
  }

  getUsersForVariation(featureFlagId: string, variationId: number): Observable<any> {
    return this.http.get(`${this.baseUrl}/variation-users`, { responseType: 'text', params: new HttpParams({fromObject: {featureFlagId, variationId}})});
  }
}
