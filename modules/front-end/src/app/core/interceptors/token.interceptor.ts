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
import {IDENTITY_TOKEN} from "../../shared/utils/localstorage-keys";
import {IResponse} from "@shared/types";

@Injectable()
export class TokenInterceptor implements HttpInterceptor {

  constructor(
    private message: NzMessageService,
    private router: Router
  ) { }

  intercept(request: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const authedReq = request.clone({
      headers: request.headers.set('Authorization', 'Bearer ' + localStorage.getItem(IDENTITY_TOKEN))
    });

    return next.handle(authedReq)
      .pipe(
        map(event => {
          if (event instanceof HttpResponse) {
            const body = event.body as IResponse;
            if (!body.success && body.errors.length > 0) {
              this.message.error(body.errors.join('/'));
            } else {
              console.log(event.body);
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

          this.showErrorMsg(errorResponse);
          throw errorResponse;
        })
      );
  }

  private showErrorMsg(errorResponse: HttpErrorResponse) {
    const errMsg = errorResponse.error?.message;
    if (errMsg) {
      this.message.error(errMsg);
    }
  }
}
