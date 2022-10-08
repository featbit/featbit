import {Injectable} from "@angular/core";
import {environment} from "../../../environments/environment";
import {HttpClient} from "@angular/common/http";
import {getCurrentProjectEnv} from "@utils/project-env";

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagService {

  public envId: string;

  get baseUrl() {
    return `${environment.url}/api/v1/envs/${this.envId}/feature-flags`;
  }

  constructor(private http: HttpClient) {
    this.envId = getCurrentProjectEnv().envId;
  }


}
