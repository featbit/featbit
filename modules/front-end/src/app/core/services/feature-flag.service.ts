import {Injectable} from "@angular/core";
import {environment} from "../../../environments/environment";
import {HttpClient, HttpParams} from "@angular/common/http";
import {getCurrentProjectEnv} from "@utils/project-env";
import {Observable, of} from "rxjs";
import {
  ICopyToEnvResult,
  IFeatureFlagListFilter,
  IFeatureFlagListModel
} from "@features/safe/feature-flags/types/switch-index";
import {catchError} from "rxjs/operators";
import {
  FeatureFlag,
  IFeatureFlag,
  IFeatureFlagTargeting,
  ISettingPayload,
  IVariationsPayload
} from "@features/safe/feature-flags/types/details";

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

  public toggleStatus(id: string): Observable<any> {
    const url = `${this.baseUrl}/${id}/toggle`;
    return this.http.put(url, {})
  }

  getByKey(key: string): Observable<IFeatureFlag> {
    return this.http.get<IFeatureFlag>(`${this.baseUrl}/${key}`);
  }

  public getList(filter: IFeatureFlagListFilter = new IFeatureFlagListFilter()): Observable<IFeatureFlagListModel> {
    const queryParam: any = {
      name: filter.name ?? '',
      tags: filter.tags ?? [],
      isArchived: filter.isArchived,
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize
    };

    if (filter.isEnabled !== null && filter.isEnabled !== undefined) {
      queryParam.isEnabled = filter.isEnabled;
    }

    return this.http.get<IFeatureFlagListModel>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  updateSetting(payload: ISettingPayload): Observable<boolean> {
    const url = `${this.baseUrl}/${payload.id}/settings`;

    return this.http.put<boolean>(url, payload);
  }

  updateVariations(payload: IVariationsPayload): Observable<boolean> {
    const url = `${this.baseUrl}/${payload.id}/variations`;

    return this.http.put<boolean>(url, payload);
  }

  delete(id: string): Observable<boolean> {
    const url = `${this.baseUrl}/${id}`;

    return this.http.delete<boolean>(url);
  }

  public isKeyUsed(key: string): Observable<boolean> {
    const url = `${this.baseUrl}/is-key-used?key=${key}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  public create(name) {
    const body = {
      name: name,
      environmentId: this.envId,
    };

    return this.http.post(this.baseUrl, body);
  }

  public copyToEnv(targetEnvId: string, flagIds: string[]): Observable<ICopyToEnvResult> {
    const url = `${this.baseUrl}/copy-to-env/${targetEnvId}`;

    return this.http.post<ICopyToEnvResult>(url, flagIds);
  }

  public archive(id: string): Observable<any> {
    const url = `${this.baseUrl}/${id}/archive`;
    return this.http.put(url, {});
  }

  public restore(id: string): Observable<any> {
    const url = `${this.baseUrl}/${id}/restore`;
    return this.http.put(url, {});
  }

  public update(payload: IFeatureFlagTargeting): Observable<boolean> {
    const url = `${this.baseUrl}/${payload.id}/targeting`;
    return this.http.put<boolean>(url, payload);
  }

  getAllTags(): Observable<string[]> {
    const url = `${this.baseUrl}/all-tags`;
    return this.http.get<string[]>(url);
  }

  setTags(flag: FeatureFlag) : Observable<boolean> {
    const url = `${this.baseUrl}/${flag.id}/tags`;
    return this.http.put<boolean>(url, flag.tags);
  }
}
