import {Injectable} from "@angular/core";
import {RefTypeEnum} from "@core/components/audit-log/types";
import {FeatureFlagDiffer} from "@shared/diffv2/feature-flag.differ";
import {IDiffer} from "@shared/diffv2";

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
