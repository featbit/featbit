import {Injectable} from "@angular/core";
import {environment} from "../../../environments/environment";
import {HttpClient, HttpParams} from "@angular/common/http";
import {getCurrentProjectEnv} from "@utils/project-env";
import {IFfParams} from "@features/safe/feature-flags/types/switch-new";
import {Observable, of} from "rxjs";
import {
  CopyToEnvResult,
  IFeatureFlagListFilter,
  IFeatureFlagListModel
} from "@features/safe/feature-flags/types/switch-index";
import {catchError} from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagService {
  public currentFeatureFlag: IFfParams = null;
  public envId: string;

  get baseUrl() {
    return `${environment.url}/api/v1/envs/${this.envId}/feature-flags`;
  }

  constructor(private http: HttpClient) {
    this.envId = getCurrentProjectEnv().envId;
  }

  public setCurrentFeatureFlag(data: IFfParams) {
    this.currentFeatureFlag = data;
  }

  public changeFeatureFlagStatus(id: string, status: 'Enabled' | 'Disabled'): Observable<any> {
    const url =this.baseUrl + '/FeatureFlags/SwitchFeatureFlag';
    return this.http.post(url, {
      "id": id,
      "environmentId": this.envId,
      "status": status
    })
  }

  public getList(filter: IFeatureFlagListFilter = new IFeatureFlagListFilter()): Observable<IFeatureFlagListModel> {
    const queryParam = {
      name: filter.name ?? '',
      status: filter.status ?? '',
      tagIds: filter.tagIds ?? [],
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IFeatureFlagListModel>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  public isNameUsed(name: string): Observable<boolean> {
    const url = `${this.baseUrl}/is-name-used?name=${name}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  public create(name) {
    const body = {
      name: name,
      environmentId: this.envId,
    };

    return this.http.post(this.baseUrl, body);
  }

  public copyToEnv(targetEnvId: string, flagIds: string[]): Observable<CopyToEnvResult> {
    const url = `${this.baseUrl}/copy-to-env/${targetEnvId}`;

    return this.http.post<CopyToEnvResult>(url, flagIds);
  }
}
