import { environment } from 'src/environments/environment';
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { SwitchTagTree } from "@features/safe/switch-manage/types/switch-index";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { getCurrentProjectEnv } from "@utils/project-env";

@Injectable({
  providedIn: 'root'
})
export class SwitchTagTreeService {

  get baseUrl() {
    const envId = getCurrentProjectEnv().envId;

    return `${environment.url}/api/v1/envs/${envId}/feature-flag-tag-tree`
  }

  constructor(private http: HttpClient) {
  }

  // get switch tag tree
  getTree(): Observable<SwitchTagTree> {
    return this.http.get(this.baseUrl).pipe(
      map((res: any) => new SwitchTagTree(res.trees))
    );
  }

  // save switch tag tree
  saveTree(tree: SwitchTagTree): Observable<SwitchTagTree> {
    return this.http.put(this.baseUrl, tree.trees).pipe(
      map((res: any) => new SwitchTagTree(res.trees))
    );
  }
}
