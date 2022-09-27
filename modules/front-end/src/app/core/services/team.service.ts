import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  baseUrl: string = `${environment.url}/api/v1/accounts/#accountId/members`;

  constructor(private http: HttpClient) { }

  public getMembers(accountId: number): Observable<any> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`) + '/old-api/get-all';
    return this.http.get(url);
  }

  public searchMembers(accountId: number, searchText: string): Observable<any> {
    const url = this.baseUrl.replace(/#accountId/ig, `${accountId}`) + `/old-api/search?searchText=${searchText}`;
    return this.http.get(url);
  }
}
