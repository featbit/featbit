import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, ResolveFn, RouterStateSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { mergeMap } from 'rxjs/operators';
import { ProjectService } from '@services/project.service';
import { OrganizationService } from '@services/organization.service';
import { IOrganization } from '@shared/types';
import { IdentityService } from "@services/identity.service";

export const AccountProjectEnvResolver: ResolveFn<any> = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
  identityService: IdentityService = inject(IdentityService),
  projectService: ProjectService = inject(ProjectService),
  organizationService: OrganizationService = inject(OrganizationService)
): Observable<any> => organizationService.getCurrentOrganization().pipe(
  mergeMap((organization: IOrganization) => {
      if (!organization) {
        identityService.doLogoutUser(false);
        return;
      }

      return projectService.setCurrentProjectEnv();
    }
  )
);
