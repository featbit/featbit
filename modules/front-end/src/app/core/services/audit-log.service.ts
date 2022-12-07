import {Injectable} from "@angular/core";
import {environment} from "../../../environments/environment";
import {HttpClient, HttpParams} from "@angular/common/http";
import {getCurrentProjectEnv} from "@utils/project-env";
import {Observable} from "rxjs";
import {AuditLogListFilter, IAuditLogListModel} from "@features/safe/audit-logs/types/audit-logs";

@Injectable({
  providedIn: 'root'
})
export class AuditLogService {
  public envId: string;

  get baseUrl() {
    return `${environment.url}/api/v1/envs/${this.envId}/audit-logs`;
  }

  constructor(private http: HttpClient) {
    this.envId = getCurrentProjectEnv().envId;
  }

  public getList(filter: AuditLogListFilter = new AuditLogListFilter()): Observable<IAuditLogListModel> {
    const queryParam = {
      query: filter.query ?? '',
      creatorId: filter.creatorId ?? '',
      refType: filter.refType ?? '',
      from: filter.range[0]?.getTime() ?? '',
      to: filter.range[1]?.getTime() ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IAuditLogListModel>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }
}
