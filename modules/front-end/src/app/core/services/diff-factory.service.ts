import {Injectable} from "@angular/core";
import {RefTypeEnum} from "@core/components/audit-log/types";
import {FeatureFlagDiffer} from "@shared/diff/feature-flag.differ";
import {IDiffer} from "@shared/diff";

@Injectable({
  providedIn: 'root'
})
export class DiffFactoryService {
  private differs = {
    [RefTypeEnum.Flag]: new FeatureFlagDiffer()
  }

  getDiffer(type: RefTypeEnum): IDiffer {
    return this.differs[type];
  }
}
