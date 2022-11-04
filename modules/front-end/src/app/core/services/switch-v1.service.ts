import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';
import {IFfParams } from '@features/safe/feature-flags/types/switch-new';

@Injectable({
  providedIn: 'root'
})
export class SwitchV1Service {
  public envId: string = null;
  public currentSwitch: IFfParams = null;

  constructor(
    private http: HttpClient
  ) {
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
