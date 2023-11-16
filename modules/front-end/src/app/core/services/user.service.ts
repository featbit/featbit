import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { IProfile } from "@shared/types";
import { USER_PROFILE } from "@utils/localstorage-keys";
import { MessageQueueService } from "@services/message-queue.service";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class UserService {

  baseUrl: string = `${environment.url}/api/v1/user`

  constructor(
    private http: HttpClient,
    private messageQueueService: MessageQueueService,
  ) { }

  getProfile() {
    return this.http.get(`${this.baseUrl}/profile`);
  }

  updateProfile(params: any): Observable<IProfile> {
    return this.http.put<IProfile>(`${this.baseUrl}/profile`, params);
  }

  hasMultipleWorkspaces(email: string): Observable<boolean> {
    return this.http.post<boolean>(`${this.baseUrl}/has-multiple-workspaces`, { email });
  }

  updateLocaleProfile(profile: IProfile) {
    localStorage.setItem(USER_PROFILE, JSON.stringify(profile));
    this.messageQueueService.emit(this.messageQueueService.topics.USER_PROFILE_CHANGED);
  }
}
