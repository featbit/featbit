import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { Observable, of } from 'rxjs';
import { take, mergeMap } from 'rxjs/operators';
import { ProjectService } from '@services/project.service';
import { OrganizationService } from '@services/organization.service';
import { IOrganization, IProjectEnv } from '@shared/types';

@Injectable()
export class AccountProjectEnvResolver implements Resolve<any> {
  constructor(
    private projectService: ProjectService,
    private accountService: OrganizationService,
  ) { }

  resolve(route: ActivatedRouteSnapshot): Observable<any> {
    return this.accountService.getCurrentOrganization().pipe(
        take(1),
        mergeMap((account: IOrganization) => {
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
