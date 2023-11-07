import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class AccountService {

  get baseUrl() {
    return `${environment.url}/api/v1/accounts`;
  }

  constructor(
    private http: HttpClient
  ) { }

  hasMultipleAccounts(email: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/has-multiple-accounts`, { email });
  }
}
