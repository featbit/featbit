import { Injectable } from "@angular/core";
import { getCurrentProjectEnv } from "@utils/project-env";
import { environment } from "src/environments/environment";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { IEnvUserProperty, IUserProp } from "@shared/types";
import { map } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class EnvUserPropService {
  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;

    return `${environment.url}/api/v2/envs/${envId}/user-property`
  }

  constructor(private http: HttpClient) {
  }

  get(): Observable<IEnvUserProperty> {
    return this.http.get<IEnvUserProperty>(this.baseUrl);
  }

  getProp(): Observable<IUserProp[]> {
    return this.get().pipe(map(userProp => userProp.userProperties.filter(x => !x.isArchived)))
  }

  upsertProp(prop: IUserProp) {
    const {id, name, presetValues, usePresetValuesOnly, isDigestField, remark} = prop;

    return this.http.put(
      `${this.baseUrl}/props/${id}/upsert`,
      {name, presetValues, usePresetValuesOnly, isDigestField, remark}
    );
  }

  archiveProp(id: string) {
    return this.http.put(`${this.baseUrl}/props/${id}/archive`, {});
  }

  upsertTag(tagId: string, source: string, requestProperty: string, userProperty: string) {
    return this.http.put(`${this.baseUrl}/tags/${tagId}/upsert`, { source, requestProperty, userProperty });
  }

  archiveTag(tagId: string) {
    return this.http.put(`${this.baseUrl}/tags/${tagId}/archive`, {});
  }
}
