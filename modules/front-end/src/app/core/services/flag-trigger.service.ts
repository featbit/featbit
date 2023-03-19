import {HttpClient, HttpParams} from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";
import { environment } from 'src/environments/environment';
import { IFlagTrigger } from "@features/safe/feature-flags/types/flag-triggers";

@Injectable({
  providedIn: 'root'
})
export class FlagTriggerService {
  baseUrl: string = environment.url + '/api/v1/triggers';

  constructor(
    private http: HttpClient
  ) {
  }

  getTriggerUrl(token: string): string {
    return this.baseUrl + `/run/${token}`;
  }

  getList(featureFlagId: string): Observable<IFlagTrigger[]> {
    return this.http.get<IFlagTrigger[]>(
      this.baseUrl,
      {params: new HttpParams({fromObject: {targetId: featureFlagId}})}
    );
  }

  updateStatus(id: string, isEnabled: boolean): Observable<boolean> {
    const url = this.baseUrl + `/${id}`;
    return this.http.put<boolean>(url, { isEnabled });
  }

  delete(id: string): Observable<boolean> {
    const url = this.baseUrl + `/${id}`;
    return this.http.delete<boolean>(url);
  }

  resetToken(id: string): Observable<string> {
    const url = this.baseUrl + `/${id}/reset-token`;
    return this.http.put<string>(url, {});
  }

  create(trigger: IFlagTrigger): Observable<IFlagTrigger> {
    return this.http.post<IFlagTrigger>(this.baseUrl, trigger);
  }
}
