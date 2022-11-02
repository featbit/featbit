import {HttpClient, HttpParams} from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { getCurrentProjectEnv } from '@utils/project-env';
import {MetricListFilter, IMetric} from "@features/safe/experiments/types";

@Injectable({
  providedIn: 'root'
})
export class MetricService {
  public envId: string = null;

  get baseUrl() {
    return environment.url + `/api/v1/envs/${this.envId}/experiment-metrics`;
  }

  constructor(
    private http: HttpClient
  ) {
    this.envId = getCurrentProjectEnv().envId;
  }

  createMetric(params: IMetric): Observable<any> {
    const url = this.baseUrl;
    return this.http.post(url, params);
  }

  updateMetric(params: IMetric): Observable<any> {
    const url = this.baseUrl;
    return this.http.put(url + `/${params.id}`, params);
  }

  getMetrics(filter: MetricListFilter = new MetricListFilter()): Observable<any> {
    const queryParam = {
      metricName: filter.metricName ?? '',
      eventType: filter.eventType ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get(this.baseUrl, {params: new HttpParams({fromObject: queryParam})});
  }

  getMetric(envId: string, id: string): Observable<any> {
    const url = this.baseUrl + `/${envId}/${id}`;
    return this.http.get(url);
  }

  archiveMetric(id: string): Observable<any> {
    const url = this.baseUrl + `/${id}/archive`;
    return this.http.put(url, {});
  }
}
