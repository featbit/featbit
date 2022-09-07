import { HttpClient } from "@angular/common/http";
import { getCurrentAccount } from "@utils/project-env";
import { environment } from "src/environments/environment";
import { Resource, ResourceTypeEnum } from "@features/iam/components/policy-editor/types";
import { Observable } from "rxjs";
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  constructor(private http: HttpClient) { }

  get baseUrl() {
    const accountId = getCurrentAccount().id;
    return `${environment.url}/api/v2/accounts/${accountId}/resources`;
  }

  getAll(type: ResourceTypeEnum, name: string): Observable<Resource[]> {
    return this.http.get<Resource[]>(`${this.baseUrl}?type=${type}&name=${name}`);
  }
}
