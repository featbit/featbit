import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { EnvUserService } from "@services/env-user.service";
import { IUserType } from "@shared/types";

export const DetailsResolver: ResolveFn<IUserType> = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  userService: EnvUserService = inject(EnvUserService)
): Observable<IUserType> => {
  const id: string = encodeURIComponent(route.params['id']);
  return userService.get(id);
};
