import { Injectable } from "@angular/core";
import { environment } from "../../../environments/environment";
import { HttpClient, HttpParams } from "@angular/common/http";
import { getCurrentProjectEnv } from "@utils/project-env";
import { firstValueFrom, Observable } from "rxjs";
import { addDays, startOfDay } from 'date-fns'
import { AuditLogListFilter, IAuditLogListModel, IDataChange } from "@core/components/audit-log/types";
import { IInstruction } from "@core/components/change-list-v2/instructions/types";
import { ISegment } from "@features/safe/segments/types/segments-index";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {

  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return `${environment.url}/api/v1/envs/${envId}/audit-logs`;
  }

  constructor(private http: HttpClient) {
  }

  public getList(filter: AuditLogListFilter = new AuditLogListFilter()): Observable<IAuditLogListModel> {
    let from = '';
    let to = '';
    if (filter.range[0]) {
      from = `${startOfDay(filter.range[0]).getTime()}`;
    }
    if (filter.range[1]) {
      to = `${startOfDay(addDays(filter.range[1], 1)).getTime()}`;
    }

    const queryParam = {
      query: filter.query ?? '',
      creatorId: filter.creatorId ?? '',
      refType: filter.refType ?? '',
      refId: filter.refId ?? '',
      from,
      to,
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IAuditLogListModel>(
      this.baseUrl,
      { params: new HttpParams({ fromObject: queryParam }) }
    );
  }

  public compare(refType: string, previous: IFeatureFlag | ISegment, current: IFeatureFlag | ISegment): Promise<IInstruction[]> {
    const url = `${this.baseUrl}/compare-${refType}`;
    return firstValueFrom(this.http.post<IInstruction[]>(
       url,
      {
        refType,
        previous,
        current
      }
    ));
  }
}
