import { environment } from 'src/environments/environment';
import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of } from "rxjs";
import {
  SegmentListFilter,
  ISegmentListModel,
  ISegment,
  ISegmentFlagReference,
  CreateSegment,
  SegmentType,
  UpdateSegmentTargetingPayload
} from "@features/safe/segments/types/segments-index";
import { getCurrentProjectEnv } from "@utils/project-env";
import { catchError } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class SegmentService {

  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return `${environment.url}/api/v1/envs/${envId}/segments`;
  }

  constructor(private http: HttpClient) {
  }

  getSegmentList(filter: SegmentListFilter = new SegmentListFilter()): Observable<ISegmentListModel> {
    const queryParam = {
      name: filter.name ?? '',
      isArchived: filter.isArchived,
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<ISegmentListModel>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  getByIds(ids: string[]): Observable<ISegment[]> {
    const url = `${this.baseUrl}/by-ids`;
    const queryParam = { ids: ids };

    return this.http.get<ISegment[]>(url, {params: new HttpParams({fromObject: queryParam})});
  }

  getSegment(id: string): Observable<ISegment> {
    return this.http.get<ISegment>(`${this.baseUrl}/${id}`);
  }

  isKeyUsed(key: string, type: SegmentType): Observable<boolean> {
    const url = `${this.baseUrl}/is-key-used?key=${key}&type=${type}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  create(payload: CreateSegment): Observable<ISegment> {
    return this.http.post<ISegment>(this.baseUrl, payload);
  }

  delete(id: string): Observable<boolean> {
    const url = `${this.baseUrl}/${id}`;

    return this.http.delete<boolean>(url);
  }

  updateName(id: string, name: string): Observable<boolean> {
    const url = `${this.baseUrl}/${id}/name`;
    return this.http.put<boolean>(url, { name });
  }

  updateDescription(id: string, description: string): Observable<boolean> {
    const url = `${this.baseUrl}/${id}/description`;
    return this.http.put<boolean>(url, { description });
  }

  updateTargeting(id: string, payload: UpdateSegmentTargetingPayload): Observable<boolean> {
    const url = `${this.baseUrl}/${id}/targeting`;
    return this.http.put<boolean>(url, payload);
  }

  archive(id: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}/archive`, {});
  }

  restore(id: string): Observable<any> {
    const url = `${this.baseUrl}/${id}/restore`;
    return this.http.put(url, {});
  }

  getFeatureFlagReferences(id: string): Observable<ISegmentFlagReference[]> {
    const url = `${this.baseUrl}/${id}/flag-references`;

    return this.http.get<ISegmentFlagReference[]>(url).pipe(catchError(() => of(undefined)));
  }

  getAllTags(): Observable<string[]> {
    const url = `${this.baseUrl}/all-tags`;
    return this.http.get<string[]>(url);
  }

  setTags(id: string, tags: string[]): Observable<boolean> {
    const url = `${this.baseUrl}/${id}/tags`;
    return this.http.put<boolean>(url, tags);
  }
}
