import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from "@angular/common/http";
import { BehaviorSubject, Observable, take, throwError } from "rxjs";
import { catchError, filter, map, switchMap } from 'rxjs/operators';
import { Router } from "@angular/router";
import { NzMessageService } from "ng-zorro-antd/message";
import { Injectable } from "@angular/core";
import { IDENTITY_TOKEN } from "@utils/localstorage-keys";
import { IResponse } from "@shared/types";
import { getCurrentOrganization } from "@utils/project-env";
import { getProfile } from "@utils/index";
import { IdentityService } from "@services/identity.service";

@Injectable()
export class RequestResponseInterceptor implements HttpInterceptor {

  private isRefreshing = false;
  private refreshTokenSubject: BehaviorSubject<string | null> = new BehaviorSubject<string | null>(null);

  constructor(
    private message: NzMessageService,
    private router: Router,
    private identity: IdentityService,
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem(IDENTITY_TOKEN);
    const currentOrgId = getCurrentOrganization()?.id ?? '';
    const currentWorkspaceId = getProfile()?.workspaceId ?? '';

    const authedReq = request.clone({
      headers: request.headers
      .set('Authorization', `Bearer ${token}`)
      .set('Organization', currentOrgId)
      .set('Workspace', currentWorkspaceId)
    });

    return next.handle(authedReq)
    .pipe(
      map(event => this.handleResponse(event)),
      catchError((errorResponse: HttpErrorResponse) => {
        if (errorResponse.status !== 401) {
          return throwError(() => errorResponse);
        }

        // Exclude auth-related endpoints from 401 refresh handling
        const url = request.url ?? '';
        const excludeUrls = ['/refresh-token', '/login-by-email', '/oidc/login', '/social/login'];

        if (excludeUrls.some(x => url.includes(x))) {
          // If refresh token itself fails, force logout
          if (url.includes('/refresh-token')) {
            this.isRefreshing = false;
            this.refreshTokenSubject.next(null);
            localStorage.clear();
            this.router.navigateByUrl('/login');
          }
          return throwError(() => errorResponse);
        }

        return this.handle401Error(request, next);
      })
    );
  }

  private handle401Error(
    request: HttpRequest<any>,
    next: HttpHandler
  ): Observable<HttpEvent<any>> {
    if (!this.isRefreshing) {
      this.isRefreshing = true;
      this.refreshTokenSubject.next(null);

      return this.identity.refreshToken().pipe(
        switchMap((res: any) => {
          this.isRefreshing = false;

          const newToken = res.token;
          localStorage.setItem(IDENTITY_TOKEN, newToken);

          this.refreshTokenSubject.next(newToken);

          const currentOrgId = getCurrentOrganization()?.id ?? '';
          const currentWorkspaceId = getProfile()?.workspaceId ?? '';

          const retryReq = request.clone({
            headers: request.headers
              .set('Authorization', `Bearer ${newToken}`)
              .set('Organization', currentOrgId)
              .set('Workspace', currentWorkspaceId)
          });

          return next.handle(retryReq).pipe(
            map(event => this.handleResponse(event))
          );
        }),
        catchError((err) => {
          this.isRefreshing = false;
          localStorage.clear();
          this.router.navigateByUrl('/login');

          // Notify any concurrent requests waiting on the refresh token
          try {
            this.refreshTokenSubject.error(err);
          } catch {
            // ignore if the subject is already in an error/complete state
          }

          // Reinitialize subject so future refresh cycles can use it
          this.refreshTokenSubject = new BehaviorSubject<string | null>(null);

          return throwError(() => err);
        })
      );
    }

    return this.refreshTokenSubject.pipe(
      filter(token => token != null),
      take(1),
      switchMap(token => {
        const currentOrgId = getCurrentOrganization()?.id ?? '';
        const currentWorkspaceId = getProfile()?.workspaceId ?? '';

        const retryReq = request.clone({
          headers: request.headers
            .set('Authorization', `Bearer ${token}`)
            .set('Organization', currentOrgId)
            .set('Workspace', currentWorkspaceId)
        });

        return next.handle(retryReq).pipe(
          map(event => this.handleResponse(event))
        );
      })
    );
  }

  private handleResponse(event: HttpEvent<any>) {
    if (!(event instanceof HttpResponse)) {
      return event;
    }

    const url = event.url ?? '';

    const excludeUrls = ['/login-by-email', '/oidc/login', '/social/login'];

    if (excludeUrls.some(x => url.endsWith(x))) {
      return event;
    }

    const body = event.body as IResponse;

    if (!body.success && body.errors?.length > 0) {
      this.message.error(body.errors.join('/'));
      return event;
    }

    return event.clone({ body: body.data });
  }
}
