import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  baseUrl: string = `${environment.url}/api/v1/organizations/#organizationId/members`;

  constructor(private http: HttpClient) { }

  public getMembers(organizationId: string): Observable<any> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`);
    return this.http.get(url);
  }

  public searchMembers(organizationId: string, searchText: string): Observable<any> {
    const url = this.baseUrl.replace(/#organizationId/ig, `${organizationId}`) + `?searchText=${searchText}`;
    return this.http.get(url);
  }
}
