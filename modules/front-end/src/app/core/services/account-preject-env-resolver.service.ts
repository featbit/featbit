import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot, Resolve } from '@angular/router';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { ProjectService } from '@services/project.service';
import { OrganizationService } from '@services/organization.service';
import { IOrganization } from '@shared/types';
import { IdentityService } from "@services/identity.service";

@Injectable()
export class AccountProjectEnvResolver implements Resolve<any> {
  constructor(
    private identityService: IdentityService,
    private projectService: ProjectService,
    private accountService: OrganizationService,
  ) { }

  resolve(route: ActivatedRouteSnapshot): Observable<any> {
    return this.accountService.getCurrentOrganization().pipe(
      mergeMap((account: IOrganization) => {
          if (!account) {
            this.identityService.doLogoutUser(false);
            return;
          }

          return this.projectService.setCurrentProjectEnv();
        }
      )
    );
  }
}
