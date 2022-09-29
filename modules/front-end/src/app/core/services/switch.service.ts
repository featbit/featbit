import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { CSwitchParams, IFfParams, IPrequisiteFeatureFlag } from '@features/safe/feature-flags/types/switch-new';
import { OrganizationService } from './organization.service';

@Injectable({
  providedIn: 'root'
})
export class SwitchService {
  public envId: number = null;
  public currentSwitch: IFfParams = null;

  constructor(
    private http: HttpClient,
    private accountService: OrganizationService,
    private router: Router
  ) {
    this.initEnvIds();
  }

  private initEnvIds() {
    const currentAccountProjectEnv = this.accountService.getCurrentOrganizationProjectEnv();
    const envId = currentAccountProjectEnv.projectEnv.envId;
    if (this.envId && envId !== this.envId) {
      this.router.navigateByUrl("/feature-flags");
    }
    this.envId = envId;
  }
  public setCurrentSwitch(data: IFfParams) {
    this.currentSwitch = data;
  }

  // 获取开关列表
  public getSwitchList(id: number): Observable<any> {
    const url = environment.url + `/FeatureFlags/GetEnvironmentFeatureFlags/${id}`;
    return this.http.get(url);
  }

  // 快速创建新的开关
  public createNewSwitch(name) {
    const url = environment.url + '/FeatureFlags/CreateFeatureFlag';
    const body = {
      name: name,
      environmentId: this.envId,
    };

    return this.http.post(url, body);
  }

  // 切换开关状态
  public changeSwitchStatus(id: string, status: 'Enabled' | 'Disabled'): Observable<any> {
    const url = environment.url + '/FeatureFlags/SwitchFeatureFlag';
    return this.http.post(url, {
      "id": id,
      "environmentId": this.envId,
      "status": status
    })
  }

  // 获取开关详情
  public getSwitchDetail(id: string): Observable<any> {
    const url = environment.url + `/FeatureFlags/GetFeatureFlag`;
    return this.http.get(url, { params: { "id": id.toString() } });
  }

  // 搜索上游开关
  public queryPrequisiteFeatureFlags(name: string = '', index: number = 0, size: number = 20): Observable<IPrequisiteFeatureFlag[]> {
    const url = environment.url + `/FeatureFlags/SearchPrequisiteFeatureFlags`;
    return this.http.get<IPrequisiteFeatureFlag[]>(url, {
      params: {
        "searchText": name.toString(),
        "environmentId": `${this.envId}`,
        "pageIndex": index.toString(),
        "pageSize": size.toString()
      }
    });
  }

  // 搜索开关
  public queryFeatureFlags(envId: number, params: any): Observable<any> {
    const url = environment.url + `/FeatureFlags/search/${envId}`;
    return this.http.get(url, { params });
  }

  // 修改开关
  public updateSwitch(param: CSwitchParams): Observable<any> {
    const switchDetail = param.getSwicthDetail();
    const url = environment.url + `/FeatureFlags/UpdateMultiOptionSupportedFeatureFlag`;
    return this.http.put(url, { ...param, ff: { ...switchDetail } });
  }

  // 存档开关
  public archiveEnvFeatureFlag(id: string, name: string): Observable<any> {
    const url = environment.url + `/FeatureFlags/ArchiveEnvironmentdFeatureFlag`;
    return this.http.post(url, {
      'featureFlagId': id,
      'featureFlgKeyName': name
    });
  }

  // 复位开关
  public unarchiveEnvFeatureFlag(id: string, name: string): Observable<any> {
    const url = environment.url + `/FeatureFlags/UnarchiveEnvironmentdFeatureFlag`;
    return this.http.post(url, {
      'featureFlagId': id,
      'featureFlgKeyName': name
    });
  }

  // 获取以存档的开关
  public getArchiveSwitch(id: number, params: any): Observable<any> {
    const url = environment.url + `/FeatureFlags/GetEnvironmentArchivedFeatureFlags/${id}`;
    return this.http.get(url, { params });
  }

  public getReport(featureFlagId: string, chartQueryTimeSpan: string): Observable<any> {
    const url = environment.url + `/FeatureFlagUsage/GetMultiOptionFeatureFlagUsageData`;
    return this.http.get(url, {
      params: {
        featureFlagId,
        chartQueryTimeSpan
      }
    });
  }
}
