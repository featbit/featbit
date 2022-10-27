import {HttpClient, HttpParams} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IExperiment, IExperimentIteration } from '@features/safe/feature-flags/types/experimentations';
import {getCurrentProjectEnv} from "@utils/project-env";
import {
  ExperimentListFilter,
  IExpt,
  IExptIteration,
  IExptStatusCount,
  IPagedExpt
} from "@features/safe/experiments/overview/types";

@Injectable({
  providedIn: 'root'
})
export class ExperimentService {

  public envId: string = null;

  get baseUrl() {
    return environment.url + `/api/v1/envs/${this.envId}/experiments`;
  }

  constructor(
    private http: HttpClient
  ) {
    this.envId = getCurrentProjectEnv().envId;
  }

  createExperiment(params: IExpt): Observable<IExpt[]> {
    const url = this.baseUrl;
    return this.http.post<IExpt[]>(url, params);
  }

  getList(filter: ExperimentListFilter = new ExperimentListFilter()): Observable<IPagedExpt> {
    const queryParam = {
      featureFlagName: filter.featureFlagName ?? '',
      featureFlagId: filter.featureFlagId ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedExpt>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  getExperimentStatusCount(): Observable<IExptStatusCount[]>{
    const url = this.baseUrl + `/status-count`;
    return this.http.get<IExptStatusCount[]>(url);
  }

  getIterationResults(params): Observable<IExptIteration[]> {
    const url = this.baseUrl + `/iteration-results`;
    return this.http.post<IExptIteration[]>(url, params);
  }

  // 获取 custom events 列表
  public getCustomEvents(envId: string, lastItem?: string, searchText?: string): Observable<string[]> {
    let url = this.baseUrl + '/Events/#envId'.replace(/#envId/ig, `${envId}`);
    let queryStr = '';
    if (lastItem !== undefined && lastItem !== null && lastItem.trim().length > 0) {
      queryStr = `?lastItem=${lastItem}`;
    }

    if (searchText !== undefined && searchText !== null && searchText.trim().length > 0) {
      if (queryStr !== '') {
        queryStr += '&';
      } else {
        queryStr = '?';
      }

      queryStr += `searchText=${searchText}`;
    }

    if (queryStr !== '') {
      url += queryStr;
    }

    return this.http.get<string[]>(url);
  }

  // 获取 experiment 结果
  getExperimentResult(envId: string, params): Observable<any> {
    const url = this.baseUrl + `/launchQuery/${envId}`;
    return this.http.post(url, params);
  }

  startIteration(envId: string, experimentId: string): Observable<any> {
    const url = this.baseUrl + `/${envId}/${experimentId}`;
    return this.http.put(url, {});
  }

  stopIteration(envId: string, experimentId: string, iterationId: string): Observable<any> {
    const url = this.baseUrl + `/${envId}/${experimentId}/${iterationId}`;
    return this.http.put(url, {});
  }

  archiveExperiment(envId: string, experimentId: string): Observable<any> {
    const url = this.baseUrl + `/${envId}/${experimentId}`;
    return this.http.delete(url);
  }

  archiveExperimentData(envId: string, experimentId: string): Observable<any> {
    const url = this.baseUrl + `/${envId}/${experimentId}/data`;
    return this.http.delete(url);
  }
}
