import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Resource, ResourceFilter } from "@shared/policy";
import { Observable } from "rxjs";
import { Injectable } from "@angular/core";

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  constructor(private http: HttpClient) {
  }

  get baseUrl() {
    return `${environment.url}/api/v1/resources`;
  }

  getResources(filter: ResourceFilter): Observable<Resource[]> {
    const queryParam = {
      name: filter.name ?? '',
      types: filter.types ?? []
    };

    return this.http.get<Resource[]>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }
}
