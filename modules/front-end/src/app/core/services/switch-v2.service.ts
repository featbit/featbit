import { environment } from 'src/environments/environment';
import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import {
  IFeatureFlagListFilter,
  IFeatureFlagDropdown,
  IFeatureFlagListModel
} from "@features/safe/feature-flags/types/switch-index";
import { getCurrentProjectEnv } from "@utils/project-env";

@Injectable({
  providedIn: 'root'
})
export class SwitchV2Service {

  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return `${environment.url}/api/v1/envs/${envId}/feature-flag`;
  }

  constructor(private http: HttpClient) { }

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
}
