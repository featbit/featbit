import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";
import { getCurrentProjectEnv } from "@utils/project-env";
import { Observable, of } from "rxjs";
import {
  ICopyToEnvResult,
  IFeatureFlagCreationPayload,
  IFeatureFlagListFilter,
  IFeatureFlagListModel
} from "@features/safe/feature-flags/types/feature-flag";
import { catchError } from "rxjs/operators";
import {
  IFeatureFlag,
  IFeatureFlagTargeting,
  ISettingPayload
} from "@features/safe/feature-flags/types/details";
import {IInsightsFilter, IInsights} from "@features/safe/feature-flags/details/insights/types";
import { IVariation } from "@shared/rules";

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagService {

  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return `${environment.url}/api/v1/envs/${envId}/feature-flags`;
  }

  constructor(private http: HttpClient) {
  }

  toggleStatus(key: string): Observable<any> {
    const url = `${this.baseUrl}/${key}/toggle`;
    return this.http.put(url, {})
  }

  getByKey(key: string): Observable<IFeatureFlag> {
    return this.http.get<IFeatureFlag>(`${this.baseUrl}/${key}`);
  }

  getList(filter: IFeatureFlagListFilter = new IFeatureFlagListFilter()): Observable<IFeatureFlagListModel> {
    const queryParam = {
      name: filter.name ?? '',
      tags: filter.tags ?? [],
      isArchived: filter.isArchived,
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
      isEnabled: filter.isEnabled ?? ''
    };

    return this.http.get<IFeatureFlagListModel>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  updateSetting(key: string, payload: ISettingPayload): Observable<boolean> {
    const url = `${this.baseUrl}/${key}/settings`;

    return this.http.put<boolean>(url, payload);
  }

  updateVariations(key: string, variations: IVariation[]): Observable<boolean> {
    const url = `${this.baseUrl}/${key}/variations`;

    return this.http.put<boolean>(url, { variations });
  }

  delete(key: string): Observable<boolean> {
    const url = `${this.baseUrl}/${key}`;

    return this.http.delete<boolean>(url);
  }

  isKeyUsed(key: string): Observable<boolean> {
    const url = `${this.baseUrl}/is-key-used?key=${key}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  create(payload: IFeatureFlagCreationPayload) {
    return this.http.post(this.baseUrl, payload);
  }

  copyToEnv(targetEnvId: string, flagIds: string[]): Observable<ICopyToEnvResult> {
    const url = `${this.baseUrl}/copy-to-env/${targetEnvId}`;

    return this.http.post<ICopyToEnvResult>(url, flagIds);
  }

  archive(key: string): Observable<any> {
    const url = `${this.baseUrl}/${key}/archive`;
    return this.http.put(url, {});
  }

  restore(key: string): Observable<any> {
    const url = `${this.baseUrl}/${key}/restore`;
    return this.http.put(url, {});
  }

  updateTargeting(payload: IFeatureFlagTargeting): Observable<boolean> {
    const url = `${this.baseUrl}/${payload.key}/targeting`;
    return this.http.put<boolean>(url, payload);
  }

  getAllTags(): Observable<string[]> {
    const url = `${this.baseUrl}/all-tags`;
    return this.http.get<string[]>(url);
  }

  setTags(flagKey: string, tags: string[]): Observable<boolean> {
    const url = `${this.baseUrl}/${flagKey}/tags`;
    return this.http.put<boolean>(url, tags);
  }

  getInsights(filter: IInsightsFilter): Observable<IInsights[]> {
    const queryParam = {...filter};
    const url = `${this.baseUrl}/insights`;
    return this.http.get<IInsights[]>(url, {params: new HttpParams({fromObject: queryParam})});
  }
}
