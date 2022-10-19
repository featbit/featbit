import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IMetric } from '@features/safe/feature-flags/types/experimentations';
import { getCurrentProjectEnv } from '@utils/project-env';

@Injectable({
  providedIn: 'root'
})
export class MetricService {
  public envId: string = null;

  get baseUrl() {
    return environment.url + `/api/v1/envs/${this.envId}/experiment-metrics`;
  }
  // baseUrl: string = environment.url + `/api/v1/envs/${this.envId}/experiment-metrics`;

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

  getMetrics(params: any): Observable<any> {
    const url = this.baseUrl;
    return this.http.get(url, { params });
  }

  getMetric(envId: string, id: string): Observable<any> {
    const url = this.baseUrl + `/${envId}/${id}`;
    return this.http.get(url);
  }

  deleteMetric(envId: string, id: string): Observable<any> {
    const url = this.baseUrl + `/${envId}/${id}`;
    return this.http.delete(url);
  }
}
