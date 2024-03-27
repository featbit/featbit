import { Injectable } from '@angular/core';
import { HttpClient } from "@angular/common/http";
import { environment } from "src/environments/environment";
import { firstValueFrom, Observable, of } from "rxjs";
import { IOidc, IWorkspace } from "@shared/types";
import { CURRENT_WORKSPACE } from "@utils/localstorage-keys";
import { catchError } from "rxjs/operators";

@Injectable({
  providedIn: 'root'
})
export class WorkspaceService {

  get baseUrl() {
    return `${environment.url}/api/v1/workspaces`;
  }

  constructor(private http: HttpClient) { }

  update(id: string, name: string, key: string): Observable<IWorkspace> {
    return this.http.put<IWorkspace>(this.baseUrl, { id, name, key });
  }

  updateOidcSetting(oidc: IOidc): Observable<IWorkspace> {
    return this.http.put<IWorkspace>(`${this.baseUrl}/sso-oidc`, oidc);
  }

  getWorkspace(): Promise<IWorkspace> {
    return firstValueFrom(
      this.http.get<IWorkspace>(this.baseUrl).pipe(catchError(() => of(undefined)))
    );
  }

  isKeyUsed(key: string): Observable<boolean> {
    const url = `${this.baseUrl}/is-key-used?key=${key}`;

    return this.http.get<boolean>(url).pipe(catchError(() => of(undefined)));
  }

  updateLicense(license: string): Observable<IWorkspace> {
    return this.http.put<IWorkspace>(`${this.baseUrl}/license`, { license });
  }

  setWorkspace(workspace: IWorkspace) {
    if (!!workspace) {
      localStorage.setItem(CURRENT_WORKSPACE(), JSON.stringify(workspace));
    } else {
      localStorage.setItem(CURRENT_WORKSPACE(), '');
    }
  }
}
