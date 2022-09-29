import { environment } from 'src/environments/environment';
import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable, of } from "rxjs";
import {
  SegmentListFilter,
  ISegmentListModel,
  ISegment,
  ISegmentFlagReference
} from "@features/safe/segments/types/segments-index";
import { getCurrentProjectEnv } from "@utils/project-env";
import { catchError } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class SegmentService {

  public current: ISegment = null;
  public envId: number;

  get baseUrl() {
    return `${environment.url}/api/v1/envs/${this.envId}/segments`;
  }

  constructor(private http: HttpClient) {
    this.envId = getCurrentProjectEnv().envId;
  }

  public getSegmentList(filter: SegmentListFilter = new SegmentListFilter()): Observable<ISegmentListModel> {
    const queryParam = {
      name: filter.name ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<ISegmentListModel>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  public getSegmentListForUser(filter: SegmentListFilter = new SegmentListFilter()): Observable<ISegmentListModel> {
    const queryParam = {
      name: filter.name ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<ISegmentListModel>(
      `${this.baseUrl}/users/${filter.userKeyId}`,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  public getByIds(ids: string[]): Observable<ISegment[]> {
    const url = `${this.baseUrl}/by-ids`;
    const queryParam = { ids: ids };

    return this.http.get<ISegment[]>(url, {params: new HttpParams({fromObject: queryParam})});
  }

  public getSegment(id: string): Observable<ISegment> {
    return this.http.get<ISegment>(`${this.baseUrl}/${id}`);
  }

  public isNameUsed(name: string): Observable<boolean> {
    const url = `${this.baseUrl}/is-name-used?name=${name}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  // 快速创建新的开关
  public create(name: string, description: string) {
    const body = {
      name,
      description,
      included: [],
      excluded: []
    };

    return this.http.post(this.baseUrl, body);
  }

  public setCurrent(data: ISegment) {
    this.current = data;
  }

  public getCurrent(): ISegment {
    return this.current;
  }


  public update(param: ISegment): Observable<any> {
    return this.http.put(`${this.baseUrl}/${param.id}`, { ...param });
  }

  public archive(id: string): Observable<any> {
    return this.http.put(`${this.baseUrl}/${id}/archive`, {});
  }

  public getFeatureFlagReferences(id: string): Observable<ISegmentFlagReference[]> {
    const url = `${this.baseUrl}/${id}/flag-segment-references`;

    return this.http.get<ISegmentFlagReference[]>(url).pipe(catchError(() => of(undefined)));
  }
}
