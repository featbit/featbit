import { Injectable } from "@angular/core";
import { Observable, of } from "rxjs";
import {
  GroupListFilter,
  GroupMemberFilter,
  GroupPolicyFilter,
  IGroup,
  IPagedGroup,
  IPagedGroupMember, IPagedGroupPolicy
} from "@features/safe/iam/types/group";
import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { catchError } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class GroupService {
  constructor(private http: HttpClient) { }

  get baseUrl() {
    return `${environment.url}/api/v1/groups`;
  }

  getList(filter: GroupListFilter = new GroupListFilter()): Observable<IPagedGroup> {
    const queryParam = {
      name: filter.name ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedGroup>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  get(id: string): Observable<IGroup> {
    return this.http.get<IGroup>(`${this.baseUrl}/${id}`);
  }

  isNameUsed(name: string) {
    const url = `${this.baseUrl}/is-name-used?name=${name}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  create(name: string, description: string): Observable<IGroup> {
    return this.http.post<IGroup>(this.baseUrl, { name: name, description: description });
  }

  update(group: IGroup): Observable<IGroup> {
    const { id, name, description } = group;

    return this.http.put<IGroup>(`${this.baseUrl}/${id}`, { name: name, description: description });
  }

  delete(id: string): Observable<boolean> {
    return this.http.delete<boolean>(`${this.baseUrl}/${id}`);
  }

  getMembers(id: string, filter: GroupMemberFilter = new GroupMemberFilter()): Observable<IPagedGroupMember> {
    const queryParam = {
      searchText: filter.searchText ?? '',
      getAllMembers: filter.getAllMembers ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedGroupMember>(
      `${this.baseUrl}/${id}/members`,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  addMember(id: string, memberId: string): Observable<boolean> {
    return this.http.put<boolean>(`${this.baseUrl}/${id}/add-member/${memberId}`, { });
  }

  removeMember(id: string, memberId: string): Observable<boolean> {
    return this.http.put<boolean>(`${this.baseUrl}/${id}/remove-member/${memberId}`, { });
  }

  getPolicies(id: string, filter: GroupPolicyFilter): Observable<IPagedGroupPolicy> {
    const queryParam = {
      name: filter.name ?? '',
      getAllPolicies: filter.getAllPolicies ?? '',
      pageIndex: filter.pageIndex - 1,
      pageSize: filter.pageSize,
    };

    return this.http.get<IPagedGroupPolicy>(
      `${this.baseUrl}/${id}/policies`,
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
