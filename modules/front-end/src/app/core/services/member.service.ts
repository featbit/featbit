import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Observable } from "rxjs";
import {
  IMember, InheritedMemberPolicyFilter, IPagedInheritedMemberPolicy,
  IMemberListModel,
  IPagedMemberGroup, IPagedMemberPolicy,
  MemberFilter,
  MemberGroupFilter,
  MemberPolicyFilter
} from "@features/safe/iam/types/member";
import { IPolicy } from "@features/safe/iam/types/policy";

@Injectable({
  providedIn: 'root'
})
export class MemberService {
  constructor(private http: HttpClient) { }

  get baseUrl() {
    return `${environment.url}/api/v1/members`;
  }

  getList(filter: MemberFilter = new MemberFilter()): Observable<IMemberListModel> {
    const queryParam = {
      searchText: filter.searchText ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IMemberListModel>(this.baseUrl, {params: new HttpParams({fromObject: queryParam})});
  }

  get(id: string) {
    return this.http.get<IMember>(`${this.baseUrl}/${id}`);
  }

  getGroups(id: string, filter: MemberGroupFilter = new MemberGroupFilter()): Observable<IPagedMemberGroup> {
    const queryParam = {
      name: filter.name ?? '',
      getAllGroups: filter.getAllGroups ?? false,
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedMemberGroup>(
      `${this.baseUrl}/${id}/groups`,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/${id}`);
  }

  update(id, payload): Observable<boolean> {
    return this.http.put<boolean>(`${this.baseUrl}/${id}`, payload);
  }

  getDirectPolicies(id: string, filter: MemberPolicyFilter): Observable<IPagedMemberPolicy> {
    const queryParam = {
      name: filter.name ?? '',
      getAllPolicies: filter.getAllPolicies ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedMemberPolicy>(
      `${this.baseUrl}/${id}/direct-policies`,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  getAllPolicies(id: string): Observable<IPolicy[]> {
    return this.http.get<IPolicy[]>(`${this.baseUrl}/${id}/policies`);
  }

  getInheritedPolicies(id: string, filter: InheritedMemberPolicyFilter): Observable<IPagedInheritedMemberPolicy> {
    const queryParam = {
      name: filter.name ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedInheritedMemberPolicy>(
      `${this.baseUrl}/${id}/inherited-policies`,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  addPolicy(id: string, policyId: string): Observable<boolean> {
    return this.http.put<boolean>(`${this.baseUrl}/${id}/add-policy/${policyId}`, { });
  }

  removePolicy(id: string, policyId: string) {
    return this.http.put<boolean>(`${this.baseUrl}/${id}/remove-policy/${policyId}`, { });
  }
}
