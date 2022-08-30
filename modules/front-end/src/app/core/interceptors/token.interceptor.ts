import {HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest} from "@angular/common/http";
import {Observable} from "rxjs";
import { catchError } from 'rxjs/operators';
import {Router} from "@angular/router";
import {NzMessageService} from "ng-zorro-antd/message";
import {Injectable} from "@angular/core";
import {IDENTITY_TOKEN} from "../../shared/utils/localstorage-keys";

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
