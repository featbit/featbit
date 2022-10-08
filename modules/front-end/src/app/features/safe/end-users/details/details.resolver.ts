import { Injectable } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { EnvUserService } from "@services/env-user.service";
import { IUserType } from "@shared/types";

@Injectable({
  providedIn: 'root'
})
export class DetailsResolver implements Resolve<IUserType> {

  constructor(private userService: EnvUserService) { }

  resolve(route: ActivatedRouteSnapshot): Observable<IUserType> {
    const id: string = encodeURIComponent(route.params['id']);
    return this.userService.get(id);
  }
}
