import { HttpClient, HttpHeaders } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { Observable } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private url = "https://featbit.co/api/feedback";
  private headers: HttpHeaders;

  constructor(private http: HttpClient) {
    this.headers = new HttpHeaders().set('token', 'uxeizS3tlCXRKLOi4GPtAU1OcVl3RkDR54HKlbt7tVZGaWTtmvfZYheQDUGLr4troWdksluYijZHGDKB');
  }

  sendFeedback(email: string, feedback: string): Observable<any> {
    return this.http.post(this.url, { email, feedback }, { headers: this.headers });
  }
}
