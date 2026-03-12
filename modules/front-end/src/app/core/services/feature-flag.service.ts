import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";
import { getCurrentOrganization, getCurrentProjectEnv } from "@utils/project-env";
import { firstValueFrom, Observable, of } from "rxjs";
import {
  CloneFlagPayload,
  CopyToEnvPrecheckResult,
  ICopyToEnvResult,
  IFeatureFlagCreationPayload,
  IFeatureFlagListFilter,
  IFeatureFlagListModel
} from "@features/safe/feature-flags/types/feature-flag";
import { catchError } from "rxjs/operators";
import {
  CreateChangeRequestPayload,
  CreateSchedulePayload,
  IFeatureFlag,
  UpdateFlagTargetingPayload
} from "@features/safe/feature-flags/types/details";
import { IInsights, IInsightsFilter } from "@features/safe/feature-flags/details/insights/types";
import { IVariation } from "@shared/rules";
import { IPendingChanges } from "@core/components/pending-changes-drawer/types";
import { FlagSortedBy } from "@features/safe/workspaces/types/organization";
import {
  CompareFlagDetail,
  CompareFlagOverviews,
  FlagSettingCopyOptions
} from "@features/safe/feature-flags/types/compare-flag";

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

  toggleStatus(key: string, status: boolean): Observable<string> {
    const url = `${this.baseUrl}/${key}/toggle/${status}`;
    return this.http.put<string>(url, {})
  }

  getByKey(key: string): Observable<IFeatureFlag> {
    return this.http.get<IFeatureFlag>(`${this.baseUrl}/${key}`);
  }

  getList(filter: IFeatureFlagListFilter = new IFeatureFlagListFilter()): Observable<IFeatureFlagListModel> {
    const org = getCurrentOrganization();

    const queryParam = {
      name: filter.name ?? '',
      tags: filter.tags ?? [],
      isArchived: filter.isArchived,
      sortBy: org.settings?.flagSortedBy ?? FlagSortedBy.CreatedAt,
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

  getCompareOverview(targetEnvIds: string[], flagFilter: IFeatureFlagListFilter): Observable<CompareFlagOverviews> {
    const org = getCurrentOrganization();

    const filter = {
      name: flagFilter.name ?? '',
      tags: flagFilter.tags ?? [],
      sortBy: org.settings?.flagSortedBy ?? FlagSortedBy.CreatedAt,
      pageIndex: flagFilter.pageIndex - 1,
      pageSize: flagFilter.pageSize
    };

    return this.http.post<CompareFlagOverviews>(
      `${this.baseUrl}/compare-overview`,
      { targetEnvIds, filter }
    );
  }

  compareFlag(targetEnvId: string, flagKey: string): Observable<CompareFlagDetail> {
    const url = `${this.baseUrl}/${flagKey}/compare-with/${targetEnvId}`;

    return this.http.get<CompareFlagDetail>(url);
  }

  copySettings(targetEnvId: string, flagKey: string, options: FlagSettingCopyOptions) {
    const url = `${this.baseUrl}/${flagKey}/copy-settings-to/${targetEnvId}`;

    return this.http.put(url, { options });
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

  updateName(key: string, name: string): Observable<string> {
    const url = `${this.baseUrl}/${key}/name`;

    return this.http.put<string>(url, {name});
  }

  updateDescription(key: string, description: string): Observable<string> {
    const url = `${this.baseUrl}/${key}/description`;

    return this.http.put<string>(url, {description});
  }

  updateOffVariation(key: string, offVariationId: string, revision: string): Observable<string> {
    const url = `${this.baseUrl}/${key}/off-variation`;

    return this.http.put<string>(url, {offVariationId, revision});
  }

  updateVariations(key: string, variations: IVariation[], revision: string): Observable<string> {
    const url = `${this.baseUrl}/${key}/variations`;

    return this.http.put<string>(url, { variations, revision });
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

  clone(originFlagKey: string, payload: CloneFlagPayload) {
    const url = `${this.baseUrl}/clone/${originFlagKey}`;
    return this.http.post(url, payload);
  }

  archive(key: string): Observable<boolean> {
    const url = `${this.baseUrl}/${key}/archive`;
    return this.http.put<boolean>(url, {});
  }

  restore(key: string): Observable<boolean> {
    const url = `${this.baseUrl}/${key}/restore`;
    return this.http.put<boolean>(url, {});
  }

  updateTargeting(key: string,  payload: UpdateFlagTargetingPayload): Observable<string> {
    const url = `${this.baseUrl}/${key}/targeting`;

    return this.http.put<string>(url, payload);
  }

  createSchedule(key: string, payload: CreateSchedulePayload): Observable<string> {
    const url = `${this.baseUrl}/${key}/schedules`;

    return this.http.post<string>(url, payload);
  }

  createChangeRequest(key: string, payload: CreateChangeRequestPayload): Observable<string> {
    const url = `${this.baseUrl}/${key}/change-requests`;

    return this.http.post<string>(url, payload);
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
