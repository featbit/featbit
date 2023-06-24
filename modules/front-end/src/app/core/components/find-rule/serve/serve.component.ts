import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { getPercentageFromRolloutPercentageArray } from '@utils/index';
import { IRuleVariation, isNotPercentageRollout, IVariation} from "@shared/rules";
import { IUserProp } from "@shared/types";
import { USER_IS_IN_SEGMENT_USER_PROP, USER_IS_NOT_IN_SEGMENT_USER_PROP } from "@shared/constants";
import { DefaultDispatchKey } from "@shared/diff/types";

interface IRuleVariationValue extends IRuleVariation {
  percentageValue: number;
}

@Component({
  selector: 'app-serve',
  templateUrl: './serve.component.html',
  styleUrls: ['./serve.component.less']
})
export class ServeComponent implements OnChanges {

  @Input() ruleVariations: IRuleVariation[] = [];

  availableVariations: IVariation[] = [];
  @Input()
  set variationOptions(value: IVariation[]) {
    this.availableVariations = [...value];
  }
  @Input() dispatchKey: string;

  dispatchKeys: string[] = [];
  filteredDispatchKeys: string[] = [];
  @Input("userProps")
  set properties(data: IUserProp[]) {
    this.dispatchKeys = data.filter((userProperty) => ![USER_IS_IN_SEGMENT_USER_PROP.name, USER_IS_NOT_IN_SEGMENT_USER_PROP.name].includes(userProperty.name))
      .map((d) => d.name);
    this.filteredDispatchKeys = [...this.dispatchKeys];
    this.dispatchKey = this.dispatchKeys.find((key) => key === this.dispatchKey) ?? DefaultDispatchKey;
  }

  @Output() onDispatchKeyChange = new EventEmitter<string>();
  @Output() onPercentageChange = new EventEmitter<IRuleVariation[]>();

  selectedVariationId: string = undefined;
  ruleVariationValues: IRuleVariationValue[] = [];
  result: IRuleVariation[] = [];

  constructor() { }

  ngOnChanges(changes: SimpleChanges) {
    this.setUp();
  }

  setUp(): void {
    if (isNotPercentageRollout(this.ruleVariations) && this.selectedVariationId !== '-1') {
      this.selectedVariationId = this.ruleVariations[0]?.id ?? this.selectedVariationId;
      this.ruleVariationValues = this.availableVariations.map((v, idx) => ({
        rollout: [0, idx === 0 ? 1 : 0],
        id: v.id,
        exptRollout: this.ruleVariations[0]?.exptRollout ?? 1,
        percentageValue: idx === 0 ? 100 : 0
      }));
    } else {
      this.selectedVariationId = '-1';
      this.ruleVariationValues = this.ruleVariationValues.length !== 0 ? this.ruleVariationValues : this.availableVariations.map(v => {
        const rule = this.ruleVariations.find(x => x.id === v.id);
        const result = {
          rollout: [0, 0],
          id: v.id,
          exptRollout: rule?.exptRollout ?? 1,
          percentageValue: 0
        }
        if (rule) {
            result.rollout = [rule.rollout[0], rule.rollout[1]];
            result.percentageValue = getPercentageFromRolloutPercentageArray(result.rollout);
        }
        return result;
      });

      this.percentageToBeAssigned = this.getPercentageToBeAssigned();
      this.dispatchKey = this.dispatchKey ?? DefaultDispatchKey;
    }
  }

  percentageToBeAssigned: number = 0;
  public modelChange() {
    // -1 means percentage rollout
    if(this.selectedVariationId === '-1') {
      let currentRollout = [0, 0];

      this.result = this.ruleVariationValues.map(r => {
        currentRollout = [currentRollout[1], currentRollout[1] + r.percentageValue * 0.01]
        return {
          rollout: currentRollout,
          id: r.id,
          exptRollout: r.exptRollout
        };
      });

      this.percentageToBeAssigned = this.getPercentageToBeAssigned();
      this.dispatchKey = this.dispatchKey ?? DefaultDispatchKey;
      this.dispatchKeyChange();
    } else {
      const variation = this.availableVariations.find(x => x.id === this.selectedVariationId);
      const rule = this.ruleVariations.find(x => x.id === variation.id);
      this.result = [
        {
          rollout: [0, 1],
          id: variation.id,
          exptRollout: rule?.exptRollout ?? 1
        }
      ];

      this.dispatchKey = null;
      this.dispatchKeyChange();
    }

    this.onOutputPercentage();
  }

  dispatchKeyChange() {
    this.onDispatchKeyChange.next(this.dispatchKey);
  }

  private getPercentageToBeAssigned(): number {
    return Number((100 - this.ruleVariationValues.reduce((acc, cur) => acc + cur.percentageValue, 0)).toFixed(3));
  }

  private onOutputPercentage() {
    this.onPercentageChange.next(Array.from(this.result));
  }
}
