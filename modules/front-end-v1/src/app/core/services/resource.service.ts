import { HttpClient, HttpParams } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { Resource, ResourceFilter, ResourceFilterV2, ResourceV2 } from "@shared/policy";
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

  get baseUrlV2() {
    return `${environment.url}/api/v2/resources`;
  }

  getResources(filter: ResourceFilter): Observable<Resource[]> {
    const queryParam = {
      name: filter.name ?? '',
      type: filter.type ?? ''
    };

    return this.http.get<Resource[]>(
      this.baseUrl,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }

  getResourcesV2(filter: ResourceFilterV2): Observable<ResourceV2[]> {
    const queryParam = {
      spaceLevel: filter.spaceLevel ?? '',
      name: filter.name ?? '',
      types: filter.types ?? []
    };

    return this.http.get<ResourceV2[]>(
      this.baseUrlV2,
      {params: new HttpParams({fromObject: queryParam})}
    );
  }
}
