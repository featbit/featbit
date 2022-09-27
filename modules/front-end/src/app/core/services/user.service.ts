import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Router } from "@angular/router";

@Injectable({
  providedIn: 'root'
})
export class UserService {

  baseUrl: string = `${environment.url}/api/v1/user`

  constructor(
    private http: HttpClient,
    private router: Router
  ) { }

  getProfile() {
    return this.http.get(`${this.baseUrl}/profile`);
  }

  updateProfile(userName: string) {
    return this.http.put(`${this.baseUrl}/profile`, { userName });
  }
}
