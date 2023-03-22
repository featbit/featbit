import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from 'src/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TeamService {
  baseUrl: string = `${environment.url}/api/v1/members`;

  constructor(private http: HttpClient) { }

  public getMembers(): Observable<any> {
    return this.http.get(this.baseUrl);
  }

  public search(searchText: string): Observable<any> {
    const url = `${this.baseUrl}?searchText=${searchText}`;
    return this.http.get(url);
  }
}
