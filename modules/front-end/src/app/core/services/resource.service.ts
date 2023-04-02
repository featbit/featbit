import { HttpClient } from "@angular/common/http";
import { getCurrentOrganization } from "@utils/project-env";
import { environment } from "src/environments/environment";
import { Resource, ResourceTypeEnum } from "@shared/policy";
import { Observable } from "rxjs";
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  constructor(private http: HttpClient) { }

  get baseUrl() {
    return `${environment.url}/api/v1/resources`;
  }

  getAll(type: ResourceTypeEnum, name: string): Observable<Resource[]> {
    return this.http.get<Resource[]>(`${this.baseUrl}?type=${type}&name=${name}`);
  }
}
