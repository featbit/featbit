import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Observable, of } from "rxjs";
import {
  IPagedPolicy,
  IPagedPolicyGroup,
  IPagedPolicyMember,
  IPolicy,
  PolicyFilter,
  PolicyGroupFilter,
  PolicyMemberFilter
} from "@features/safe/iam/types/policy";
import { catchError } from "rxjs/operators";
import { IPolicyStatement } from "@shared/policy";

@Injectable({
  providedIn: 'root'
})
export class PolicyService {
  constructor(private http: HttpClient) { }

  get baseUrl() {
    return `${environment.url}/api/v1/policies`;
  }

  getList(filter: PolicyFilter = new PolicyFilter()): Observable<IPagedPolicy> {
    const queryParam = {
      name: filter.name ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedPolicy>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  get(id: string): Observable<IPolicy> {
    return this.http.get<IPolicy>(`${this.baseUrl}/${id}`);
  }

  isNameUsed(name: string) {
    const url = `${this.baseUrl}/is-name-used?name=${name}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  create(name: string, description: string): Observable<IPolicy> {
    return this.http.post<IPolicy>(this.baseUrl, { name: name, description: description });
  }

  updateSetting(policy: IPolicy): Observable<IPolicy> {
    const { id, name, description } = policy;

    return this.http.put<IPolicy>(`${this.baseUrl}/${id}/settings`, { name: name, description: description });
  }

  updateStatements(id: string, statements: IPolicyStatement[]) {
    return this.http.put<IPolicy>(`${this.baseUrl}/${id}/statements`, statements);
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/${id}`);
  }

  getGroups(id: string, filter: PolicyGroupFilter = new PolicyGroupFilter()): Observable<IPagedPolicyGroup> {
    const queryParam = {
      name: filter.name ?? '',
      getAllGroups: filter.getAllGroups ?? false,
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedPolicyGroup>(
      `${this.baseUrl}/${id}/groups`,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  getMembers(id: string, filter: PolicyMemberFilter = new PolicyMemberFilter()): Observable<IPagedPolicyMember> {
    const queryParam = {
      searchText: filter.searchText ?? '',
      getAllMembers: filter.getAllMembers ?? false,
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedPolicyMember>(
      `${this.baseUrl}/${id}/members`,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }
}
