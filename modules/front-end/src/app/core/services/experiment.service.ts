import {HttpClient, HttpParams} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {getCurrentProjectEnv} from "@utils/project-env";
import {
  ExperimentListFilter,
  IExpt, IExptCreation,
  IExptIteration,
  IExptStatusCount,
  IPagedExpt
} from "@features/safe/experiments/types";

@Injectable({
  providedIn: 'root'
})
export class ExperimentService {

  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return environment.url + `/api/v1/envs/${envId}/experiments`;
  }

  constructor(private http: HttpClient) {
  }

  createExperiment(params: IExptCreation): Observable<IExpt[]> {
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

  getFeatureFlagVariationReferences(featureFlagId: string, variationId: string): Observable<IExpt[]> {
    const queryParam = {
      featureFlagId,
      variationId
    };

    return this.http.get<IExpt[]>(
      `${this.baseUrl}/variation-experiment-references`,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  getExperimentStatusCount(): Observable<IExptStatusCount[]>{
    const url = `${this.baseUrl}/status-count`;
    return this.http.get<IExptStatusCount[]>(url);
  }

  getIterationResults(params): Observable<IExptIteration[]> {
    const url = `${this.baseUrl}/iteration-results`;
    return this.http.put<IExptIteration[]>(url, params);
  }

  startIteration(experimentId: string): Observable<any> {
    const url = `${this.baseUrl}/${experimentId}/iterations`;
    return this.http.post(url, {});
  }

  stopIteration(experimentId: string, iterationId: string): Observable<any> {
    const url = `${this.baseUrl}/${experimentId}/iterations/${iterationId}`;
    return this.http.put(url, {});
  }

  archiveExperiment(experimentId: string): Observable<any> {
    const url = `${this.baseUrl}/${experimentId}`;
    return this.http.delete(url);
  }

  archiveExperimentData(experimentId: string): Observable<any> {
    const url = `${this.baseUrl}/${experimentId}/iterations`;
    return this.http.delete(url);
  }
}
