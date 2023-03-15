import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private url = "https://www.featbit.co/api/feedback";
  private headers: HttpHeaders;

  constructor(private http: HttpClient) {
    this.headers = new HttpHeaders().set('token', 'uxeizS3tlCXRKLOi4GPtAU1OcVl3RkDR54HKlbt7tVZGaWTtmvfZYheQDUGLr4troWdksluYijZHGDKB');
  }

  sendFeedback(email: string, message: string): Observable<any> {
    return this.http.post(this.url, { email, message }, { headers: this.headers });
  }
}
