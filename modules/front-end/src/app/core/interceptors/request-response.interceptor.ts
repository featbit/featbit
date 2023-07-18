import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
  HttpResponse
} from "@angular/common/http";
import {Observable} from "rxjs";
import {catchError, map} from 'rxjs/operators';
import {Router} from "@angular/router";
import {NzMessageService} from "ng-zorro-antd/message";
import {Injectable} from "@angular/core";
import { IDENTITY_TOKEN } from "@utils/localstorage-keys";
import {IResponse} from "@shared/types";
import { getCurrentOrganization } from "@utils/project-env";

@Injectable()
export class RequestResponseInterceptor implements HttpInterceptor {

  constructor(
    private message: NzMessageService,
    private router: Router
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = localStorage.getItem(IDENTITY_TOKEN);
    const currentOrgId = getCurrentOrganization()?.id ?? '';

    const authedReq = request.clone({
      headers: request.headers
        .set('Authorization', `Bearer ${token}`)
        .set('Organization', currentOrgId)
    });

    return next.handle(authedReq)
      .pipe(
        map(event => {
          if (event instanceof HttpResponse && !event.url.endsWith('/login-by-email')) {
            const body = event.body as IResponse;
            if (!body.success && body.errors.length > 0) {
              this.message.error(body.errors.join('/'));
            } else {
              event = event.clone({ body: event.body.data });
            }
          }

          return event;
        }),
        catchError((errorResponse: HttpErrorResponse) => {
          if (errorResponse.status === 401) {
            localStorage.clear();
            this.router.navigateByUrl('/login');
          }

          throw errorResponse.error;
        })
      );
  }
}
