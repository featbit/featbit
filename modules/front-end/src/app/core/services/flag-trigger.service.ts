import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from 'src/environments/environment';
import { FlagTriggerStatus, IFlagTrigger } from "@features/safe/switch-manage/types/flag-triggers";

@Injectable({
  providedIn: 'root'
})
export class FlagTriggerService {
  baseUrl: string = environment.url + '/api/FeatureFlagTriggers';

  constructor(
    private http: HttpClient
  ) {
  }

  getTriggerUrl(token: string): string {
    return this.baseUrl + `/trigger/${token}`;
  }

  getTriggers(featureFlagId: string): Observable<IFlagTrigger[]> {
    const url = this.baseUrl + '/' + featureFlagId;
    return this.http.get<IFlagTrigger[]>(url);
  }

  updateTriggerStatus(id: string, featureFlagId: string, status: FlagTriggerStatus): Observable<IFlagTrigger> {
    const url = this.baseUrl + `/${id}/${featureFlagId}/${status}`;
    return this.http.put<IFlagTrigger>(url, {});
  }

  resetTriggerToken(id: string, featureFlagId: string): Observable<IFlagTrigger> {
    const url = this.baseUrl + `/token/${id}/${featureFlagId}`;
    return this.http.put<IFlagTrigger>(url, {});
  }

  createTrigger(trigger: IFlagTrigger): Observable<IFlagTrigger> {
    return this.http.post<IFlagTrigger>(this.baseUrl, trigger);
  }
}
