import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { Observable, of } from 'rxjs';
import { take, mergeMap } from 'rxjs/operators';
import { ProjectService } from '@services/project.service';
import { AccountService } from '@services/account.service';
import { IAccount, IProjectEnv } from '@shared/types';

@Injectable()
export class AccountProjectEnvResolver implements Resolve<any> {
  constructor(
    private projectService: ProjectService,
    private accountService: AccountService,
  ) { }

  resolve(route: ActivatedRouteSnapshot): Observable<any> {
    return this.accountService.getCurrentAccount().pipe(
        take(1),
        mergeMap((account: IAccount) => {
            return this.projectService.getCurrentProjectEnv(account.id).pipe(
              take(1),
              mergeMap((projectEnv: IProjectEnv) => {
                return of({});
              })
            )
          }
        )
      );
  }
}
