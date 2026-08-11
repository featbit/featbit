import { Injectable } from '@angular/core';
import { GlobalUserFilter, PagedGlobalUser } from "@features/safe/workspaces/types/global-user";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Observable } from "rxjs";
import { environment } from "../../../environments/environment";

@Injectable({
  providedIn: 'root'
})
export class GlobalUserService {

  constructor(private http: HttpClient) {
  }

  get baseUrl() {
    return `${environment.url}/api/v1/global-users`;
  }

  uploadUrl(): string {
    return `${this.baseUrl}/upload`;
  }

  getList(filter: GlobalUserFilter = new GlobalUserFilter()): Observable<PagedGlobalUser> {
    const query = {
      name: filter.name ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<PagedGlobalUser>(
      this.baseUrl,
      {params: new HttpParams({fromObject: query})}
    );
  }
}
