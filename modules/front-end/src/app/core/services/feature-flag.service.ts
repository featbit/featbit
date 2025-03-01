import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";
import { getCurrentProjectEnv } from "@utils/project-env";
import { firstValueFrom, Observable, of } from "rxjs";
import {
  CopyToEnvPrecheckResult,
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
import { IPendingChanges } from "@core/components/pending-changes-drawer/types";

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

  getPendingChanges(key: string): Promise<IPendingChanges[]> {
    return firstValueFrom(this.http.get<IPendingChanges[]>(`${this.baseUrl}/${key}/pending-changes`));
  }

  deleteSchedule(id: string): Observable<boolean> {
    const url = `${this.baseUrl}/schedules/${id}`;

    return this.http.delete<boolean>(url);
  }

  deleteChangeRequest(id: string): Observable<boolean> {
    const url = `${this.baseUrl}/change-requests/${id}`;

    return this.http.delete<boolean>(url);
  }

  declineChangeRequest(id: string): Observable<boolean> {
    const url = `${this.baseUrl}/change-requests/${id}/decline`;

    return this.http.put<boolean>(url, {});
  }

  approveChangeRequest(id: string): Observable<boolean> {
    const url = `${this.baseUrl}/change-requests/${id}/approve`;

    return this.http.put<boolean>(url, {});
  }

  applyChangeRequest(id: string): Observable<boolean> {
    const url = `${this.baseUrl}/change-requests/${id}/apply`;

    return this.http.put<boolean>(url, {});
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

  copyToEnvPrecheck(targetEnvId: string, flagIds: string[]): Observable<CopyToEnvPrecheckResult[]> {
    const url = `${this.baseUrl}/copy-to-env-precheck/${targetEnvId}`;

    return this.http.post<CopyToEnvPrecheckResult[]>(url, flagIds);
  }

  copyToEnv(targetEnvId: string, flagIds: string[], precheckResults: CopyToEnvPrecheckResult[]): Observable<ICopyToEnvResult> {
    const url = `${this.baseUrl}/copy-to-env/${targetEnvId}`;

    return this.http.post<ICopyToEnvResult>(url, {
      flagIds,
      precheckResults
    });
  }

  archive(key: string): Observable<any> {
    const url = `${this.baseUrl}/${key}/archive`;
    return this.http.put(url, {});
  }

  restore(key: string): Observable<any> {
    const url = `${this.baseUrl}/${key}/restore`;
    return this.http.put(url, {});
  }

  updateTargeting(targeting: IFeatureFlagTargeting, comment?: string): Observable<boolean> {
    const url = `${this.baseUrl}/${targeting.key}/targeting`;

    const payload = {
      targeting,
      comment
    };

    return this.http.put<boolean>(url, payload);
  }

  createSchedule(targeting: IFeatureFlagTargeting, scheduledTime: Date, title: string, reviewers: string[], reason: string, withChangeRequest: boolean = false): Observable<boolean> {
    const url = `${this.baseUrl}/${targeting.key}/schedules`;

    const payload = {
      targeting,
      scheduledTime,
      title,
      reason,
      reviewers,
      withChangeRequest
    };

    return this.http.post<boolean>(url, payload);
  }

  createChangeRequest(targeting: IFeatureFlagTargeting, reviewers: string[], reason: string): Observable<boolean> {
    const url = `${this.baseUrl}/${targeting.key}/change-requests`;

    const payload = {
      targeting,
      reviewers,
      reason
    };

    return this.http.post<boolean>(url, payload);
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
