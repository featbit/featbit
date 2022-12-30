import {Injectable} from "@angular/core";
import {RefTypeEnum} from "@core/components/audit-log/types";
import {FeatureFlagDiffer} from "@shared/diff/feature-flag.differ";
import {IDiffer} from "@shared/diff";
import {SegmentDiffer} from "@shared/diff/segment.differ";

@Injectable({
  providedIn: 'root'
})
export class DiffFactoryService {
  private differs = {
    [RefTypeEnum.Flag]: new FeatureFlagDiffer(),
    [RefTypeEnum.Segment]: new SegmentDiffer()
  }

  getDiffer(type: RefTypeEnum): IDiffer {
    return this.differs[type];
  }
}
