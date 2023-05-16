import { Injectable } from "@angular/core";
import { getCurrentProjectEnv } from "@utils/project-env";
import { environment } from "src/environments/environment";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { IUserProp } from "@shared/types";

@Injectable({
  providedIn: 'root'
})
export class EnvUserPropService {
  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;
    return `${environment.url}/api/v1/envs/${envId}/end-user-properties`
  }

  constructor(private http: HttpClient) {
  }

  get(): Observable<IUserProp[]> {
    return this.http.get<IUserProp[]>(this.baseUrl);
  }

  upsertProp(prop: IUserProp) {
    const {id, name, presetValues, usePresetValuesOnly, isDigestField, remark} = prop;

    return this.http.put(
      `${this.baseUrl}/${id}/upsert`,
      {name, presetValues, usePresetValuesOnly, isDigestField, remark}
    );
  }

  archiveProp(id: string) {
    return this.http.delete(`${this.baseUrl}/${id}`, {});
  }

  upsertTag(tagId: string, source: string, requestProperty: string, userProperty: string) {
    return this.http.put(`${this.baseUrl}/tags/${tagId}/upsert`, { source, requestProperty, userProperty });
  }

  archiveTag(tagId: string) {
    return this.http.put(`${this.baseUrl}/tags/${tagId}/archive`, {});
  }
}
