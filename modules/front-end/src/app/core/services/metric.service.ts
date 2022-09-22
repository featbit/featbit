import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import { IMetric } from '@features/safe/feature-flags/types/experimentations';

@Injectable({
  providedIn: 'root'
})
export class MetricService {

  baseUrl: string = environment.url + '/api/metrics';

  constructor(
    private http: HttpClient
  ) {}

  createMetric(params: IMetric): Observable<any> {
    const url = this.baseUrl;
    return this.http.post(url, params);
  }

  updateMetric(params: IMetric): Observable<any> {
    const url = this.baseUrl;
    return this.http.put(url, params);
  }

  getMetrics(params: any): Observable<any> {
    const url = this.baseUrl;
    return this.http.get(url, { params });
  }

  getMetric(envId: number, id: string): Observable<any> {
    const url = this.baseUrl + `/${envId}/${id}`;
    return this.http.get(url);
  }

  deleteMetric(envId: number, id: string): Observable<any> {
    const url = this.baseUrl + `/${envId}/${id}`;
    return this.http.delete(url);
  }
}
