import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Router } from "@angular/router";
import {IAccountUser, IAuthProps} from "@shared/types";
import {USER_PROFILE} from "@utils/localstorage-keys";
import {MessageQueueService} from "@services/message-queue.service";

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

  updateProfile(params: any) {
    return this.http.put(`${this.baseUrl}/profile`, params);
  }

  updateLocaleProfile(profile: IAuthProps) {
    localStorage.setItem(USER_PROFILE, JSON.stringify(profile));
    this.messageQueueService.emit(this.messageQueueService.topics.USER_PROFILE_CHANGED);
  }
}
