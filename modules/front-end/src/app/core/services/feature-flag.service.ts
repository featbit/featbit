import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";
import { getCurrentProjectEnv } from "@utils/project-env";
import { Observable, of } from "rxjs";
import {
  ICopyToEnvResult,
  IFeatureFlagListFilter,
  IFeatureFlagListModel
} from "@features/safe/feature-flags/types/switch-index";
import { catchError } from "rxjs/operators";
import {
  IFeatureFlag,
  IFeatureFlagTargeting,
  ISettingPayload,
  IVariationsPayload
} from "@features/safe/feature-flags/types/details";
import {IInsightsFilter, IInsights} from "@features/safe/feature-flags/details/insights/types";

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagService {
  public currentFeatureFlag: IFeatureFlag = null;
  public envId: string;

  get baseUrl() {
    return `${environment.url}/api/v1/envs/${this.envId}/feature-flags`;
  }

  constructor(private http: HttpClient) {
    this.envId = getCurrentProjectEnv().envId;
  }

  public setCurrentFeatureFlag(data: IFeatureFlag) {
    this.currentFeatureFlag = data;
  }

  public toggleStatus(key: string): Observable<any> {
    const url = `${this.baseUrl}/${key}/toggle`;
    return this.http.put(url, {})
  }

  getByKey(key: string): Observable<IFeatureFlag> {
    return this.http.get<IFeatureFlag>(`${this.baseUrl}/${key}`);
  }

  public getList(filter: IFeatureFlagListFilter = new IFeatureFlagListFilter()): Observable<IFeatureFlagListModel> {
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

  updateSetting(payload: ISettingPayload): Observable<boolean> {
    const url = `${this.baseUrl}/${payload.key}/settings`;

    return this.http.put<boolean>(url, payload);
  }

  updateVariations(payload: IVariationsPayload): Observable<boolean> {
    const url = `${this.baseUrl}/${payload.key}/variations`;

    return this.http.put<boolean>(url, payload);
  }

  delete(key: string): Observable<boolean> {
    const url = `${this.baseUrl}/${key}`;

    return this.http.delete<boolean>(url);
  }

  public isKeyUsed(key: string): Observable<boolean> {
    const url = `${this.baseUrl}/is-key-used?key=${key}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  public create(payload) {
    return this.http.post(this.baseUrl, payload);
  }

  public copyToEnv(targetEnvId: string, flagIds: string[]): Observable<ICopyToEnvResult> {
    const url = `${this.baseUrl}/copy-to-env/${targetEnvId}`;

    return this.http.post<ICopyToEnvResult>(url, flagIds);
  }

  public archive(key: string): Observable<any> {
    const url = `${this.baseUrl}/${key}/archive`;
    return this.http.put(url, {});
  }

  public restore(key: string): Observable<any> {
    const url = `${this.baseUrl}/${key}/restore`;
    return this.http.put(url, {});
  }

  public updateTargeting(payload: IFeatureFlagTargeting): Observable<boolean> {
    const url = `${this.baseUrl}/${payload.key}/targeting`;
    return this.http.put<boolean>(url, payload);
  }

  getAllTags(): Observable<string[]> {
    const url = `${this.baseUrl}/all-tags`;
    return this.http.get<string[]>(url);
  }

  setTags(flag: IFeatureFlag): Observable<boolean> {
    const url = `${this.baseUrl}/${flag.key}/tags`;
    return this.http.put<boolean>(url, flag.tags);
  }

  public getInsights(filter: IInsightsFilter): Observable<IInsights[]> {
    const queryParam = {...filter};
    const url = `${this.baseUrl}/insights`;
    return this.http.get<IInsights[]>(url, {params: new HttpParams({fromObject: queryParam})});
  }
}
