import { BehaviorSubject } from "rxjs";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { IProjectEnv } from "@shared/types";
import { TeamService } from "@services/team.service";
import { IUserType } from "@shared/types";
import { isNotPercentageRollout, isSegmentRule, isSingleOperator } from "@shared/utils";
import { ruleValueConfig, ruleType } from "@core/components/find-rule/ruleConfig";
import { IFfParams, IFfpParams, IFftuwmtrParams, IJsonContent, IPrequisiteFeatureFlag, IRulePercentageRollout, IVariationOption } from "./switch-new";

export enum InstructionKindEnum {
  UpdateStatus = 'updateStatus',
  AddUserTargets = 'addUserTargets',
  RemoveUserTargets = 'removeUserTargets',
  AddRule = 'addRule',
  RemoveRule = 'removeRule',
  UpdateRuleClause = 'updateRuleClause',
  UpdateRuleVariationOrRollout = 'updateRuleVariationOrRollout',
  UpdateOffVariation = 'updateOffVariation',
  UpdateFallthroughVariationOrRollout = "updateFallthroughVariationOrRollout",

  AddPrerequisiteFeature = 'addPrerequisiteFeature',
  RemovePrerequisiteFeature = 'removePrerequisiteFeature',
  UpdatePrerequisiteFeature = 'updatePrerequisiteFeature'
}

export interface IPendingChange {
  id: string;
  featureFlagId: string;
  envId: number;
  projectId: number;
  updatedAt: string;
  createdAt: string;
  instructions: IInstruction[];
}

export interface IInstruction {
  kind: InstructionKindEnum;
  variationOptionId?: number;
  ruleId?: string;
  featureFlagId?: string;
  clauses?: IJsonContent[];
  rolloutWeights?: {[key: string]: number};
  rolloutVariationPercentage?: any[]; // dont't need to push to server
  targetUsers?: string[];
  status?: string;
  extra?: any; // dont't need to push to server
}

interface IOriginalFFData {
  status: string,
  targetIndividuals: {[key: string]: IUserType[]};
  fftuwmtr: IFftuwmtrParams[];
  fallThroughVariations: IRulePercentageRollout[];
  variationOptionWhenDisabled: IVariationOption;
  prerequisiteFeatures: IFfpParams[]
}

export class PendingChange {
  private data: IPendingChange;
  private originalFFData: IOriginalFFData;
  private variationOptions = {};
  private ffList = [];
  public categorizedInstructions: any = [];

  constructor(private teamService: TeamService, private accountId: number, public projectEnv: IProjectEnv, public featureFlag: IFfParams, variationOptions: IVariationOption[], private parentUrl: string){
    this.data = {
      projectId: projectEnv.projectId,
      envId: projectEnv.projectId,
      featureFlagId: featureFlag.id,
      instructions: []
    } as IPendingChange;

    variationOptions.forEach(v => {
      this.variationOptions[v.localId] = v;
    })

    this.searchChange$.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(searchText => {
      this.teamService.searchMembers(this.accountId, searchText).subscribe((result) => {
        this.reviewerList = result;
        this.isReviewersLoading = false;
      }, _ => {
        this.isReviewersLoading = false;
      });
    });
  }

  public hasInstruction(): boolean {
    return this.data.instructions.length > 0;
  }

  canSubmit() {
    return this.hasInstruction();
  }

  public setFeatureFlagList(ffList: IPrequisiteFeatureFlag[]) {
    this.ffList = ffList;
  }

  public initialize(
    targetIndividuals: {[key: string]: IUserType[]},
    variationOptionWhenDisabled: IVariationOption,
    fallThroughVariations: IRulePercentageRollout[],
    fftuwmtr: IFftuwmtrParams[],
    prerequisiteFeatures: IFfpParams[],
    status: string
    ) {
    this.originalFFData = {
      targetIndividuals: Object.assign({}, targetIndividuals),
      fallThroughVariations: fallThroughVariations.map(f => Object.assign({}, f)),
      variationOptionWhenDisabled: Object.assign({}, variationOptionWhenDisabled),
      fftuwmtr: this.preprocessFftuwmtr(fftuwmtr),
      prerequisiteFeatures: prerequisiteFeatures.map(f => Object.assign({}, f)),
      status: status
    };
  }

  comment: string = '';
  selectedReviewers: any[] = [];
  searchChange$ = new BehaviorSubject('');
  isReviewersLoading = false;
  reviewerList: string[];
  onSearchReviewers(value: string): void {
    if (value.length > 0) {
      this.isReviewersLoading = true;
      this.searchChange$.next(value);
    }
  }

  private getVariationValue(variationOptionId: number) {
    return this.variationOptions[variationOptionId].variationValue;
  }

  private generateRuleChanges(ins: IInstruction): string {
    const serveStr = `serve ${!!ins.variationOptionId ? this.getVariationValue(ins.variationOptionId) : ins.rolloutVariationPercentage.reduce((acc, cur, idx) => { acc += cur.valueOption.variationValue + ` (${ins.rolloutWeights[cur.valueOption.localId] * 100}%)</span>`; acc += idx === ins.rolloutVariationPercentage.length - 1? '</span>' : '<span>'; return acc;}, '<span>')}`;
    const clauseStr = '<ul class="no-style"><li class="clause">'
    + ins.clauses.map(c => `if ${c.property} ${c.operation} ${!isSingleOperator(c.type)? '<span class="ant-tag">' + (c.type === "multi" ? c.multipleValue.join('</span><span class="ant-tag">') : c.value) + '</span>' : ''}`)
                 .join(`</li> <li class="and">AND</li> <li class="clause">`) + `</li><li>${serveStr}</li></ul>`;
    return clauseStr;
  }

  private getStatusLabel(status: string): string {
    if (status === 'Enabled') return '开';
    if (status === 'Disabled') return '关';
    return '';
  }

  private categorizeInstructions() {
    const categories = {
      'status': {
        'category': '状态',
        'changes': []
      },
      'prerequisite': {
        'category': '上游开关',
        'changes': []
      },
      'individualUsers': {
        'category': '目标用户',
        'changes': []
      },
      'rules': {
        'category': '匹配规则',
        'changes': []
      },
      'fallThrough': {
        'category': '默认返回值',
        'changes': []
      },
      'off': {
        'category': '开关关闭时的返回值',
        'changes': []
      }
    };

    this.data.instructions.forEach(ins => {
      switch(ins.kind) {
        case InstructionKindEnum.UpdateStatus:
          categories['prerequisite'].changes.push(`更新开关状态到 <span class="ant-tag">${this.getStatusLabel(ins.status)}</span>`);
          break;
        case InstructionKindEnum.AddPrerequisiteFeature:
          categories['prerequisite'].changes.push(`添加上游开关 <a target="_blank" href="${this.parentUrl + ins.extra.selectedFeatureFlag.id}">${ins.extra.selectedFeatureFlag.name}</a>`);
          break;
        case InstructionKindEnum.RemovePrerequisiteFeature:
          categories['prerequisite'].changes.push(`移除上游开关 <a target="_blank" href="${this.parentUrl + ins.extra.selectedFeatureFlag.id}">${ins.extra.selectedFeatureFlag.name}</a>`);
          break;
        case InstructionKindEnum.UpdatePrerequisiteFeature:
          let ff = ins.extra;
          categories['prerequisite'].changes.push(`将上游开关 <a target="_blank" href="${this.parentUrl + ff.selectedFeatureFlag.id}">${ff.selectedFeatureFlag.name}</a> 的返回值设置为 <span class="ant-tag"> ${ff.valueOptionsVariationValue.variationValue}</span>`);
          break;
        case InstructionKindEnum.AddUserTargets:
          categories['individualUsers'].changes.push(`向 <span class="ant-tag">${this.getVariationValue(ins.variationOptionId)}</span>添加 ${'<span class="ant-tag">' + ins.targetUsers.join('</span><span class="ant-tag">') + '</span>'}`);
          break;
        case InstructionKindEnum.RemoveUserTargets:
          categories['individualUsers'].changes.push(`从 <span class="ant-tag">${this.getVariationValue(ins.variationOptionId)}</span>移除 ${'<span class="ant-tag">' + ins.targetUsers.join('</span><span class="ant-tag">') + '</span>'}`);
          break;
        case InstructionKindEnum.AddRule:
          categories['rules'].changes.push(`添加: ${ins.extra.ruleName} ${this.generateRuleChanges(ins)}`);
          break;
        case InstructionKindEnum.RemoveRule:
          categories['rules'].changes.push(`移除: ${ins.extra.ruleName} ${this.generateRuleChanges(ins)}`);
          break;
        // case InstructionKindEnum.UpdateRuleClause: // never happen
        //   categories['rules'].changes.push(`更新: ${ins.extra.ruleName} ${this.generateRuleChanges(ins)}`);
        //   break;
        case InstructionKindEnum.UpdateRuleVariationOrRollout:
          categories['rules'].changes.push(`更新: ${ins.extra.ruleName} ${this.generateRuleChanges(ins)}`);
          break;
        case InstructionKindEnum.UpdateFallthroughVariationOrRollout:
          const defaultStr = `${!!ins.variationOptionId ? this.getVariationValue(ins.variationOptionId) : ins.rolloutVariationPercentage.reduce((acc, cur, idx) => { acc += cur.valueOption.variationValue + ` (${ins.rolloutWeights[cur.valueOption.localId]})</span>`; idx === ins.rolloutVariationPercentage.length - 1? '</span>' : '<span>'; return acc;}, '<span>')}`;
          categories['fallThrough'].changes.push(`设置为 ${defaultStr}`);
          break;
        case InstructionKindEnum.UpdateOffVariation:
          categories['off'].changes.push(`设置为 ${this.getVariationValue(ins.variationOptionId)}`);
          break;
      }
    });

    this.categorizedInstructions = [
      categories['status'],
      categories['prerequisite'], categories['individualUsers'], categories['rules'], categories['fallThrough'], categories['off']
    ];
  }

  public generateInstructions(
    newTargetIndividuals: {[key: string]: IUserType[]},
    variationOptionWhenDisabled: IVariationOption,
    fallThroughVariations: IRulePercentageRollout[],
    fftuwmtr: IFftuwmtrParams[],
    prerequisiteFeatures: IFfpParams[],
    status: string
    ) {
      this.data.instructions = [];

      this.generateUserTargetsInstructions(newTargetIndividuals);
      this.generateOffVariationInstruction(variationOptionWhenDisabled);
      this.generateFallThroughVariationInstruction(fallThroughVariations);
      this.generateFftuwmtrInstruction(fftuwmtr);
      this.generatePrerequisiteFeaturesInstruction(prerequisiteFeatures);
      this.generateStatusInstruction(status);

      this.categorizeInstructions();
  }

  private generateStatusInstruction(status: string) {
    if (this.originalFFData.status !== status) {
      this.upInsertInstruction({
        kind: InstructionKindEnum.UpdateStatus,
        status
      });
    }
  }

  private upInsertInstruction(instruction: IInstruction, compareFun?: (a: IInstruction, b: IInstruction) => boolean) {
    let idx = -1;

    if (!!compareFun) {
      idx = this.data.instructions.findIndex(i => compareFun(i, instruction));
    } else {
      idx = this.data.instructions.findIndex(i => i.kind === instruction.kind && i.variationOptionId === instruction.variationOptionId);
    }

    if (idx !== -1) {
      this.data.instructions.splice(idx, 1);
    }

    this.data.instructions.push(instruction);
  }

  private generatePrerequisiteFeaturesInstruction(prerequisiteFeatures: IFfpParams[]) {
    this.originalFFData.prerequisiteFeatures.forEach(p => {
      const found = prerequisiteFeatures.find(f => p.prerequisiteFeatureFlagId === f.prerequisiteFeatureFlagId);
      if (found) {
        if (found.valueOptionsVariationValue?.localId !==  p.valueOptionsVariationValue?.localId) {
          this.upInsertInstruction({
            kind: InstructionKindEnum.UpdatePrerequisiteFeature,
            featureFlagId: found.prerequisiteFeatureFlagId,
            variationOptionId: found.valueOptionsVariationValue.localId,
            extra: found
          });
        }
      } else {
        const removedFF = this.ffList.find(f => f.id === p.prerequisiteFeatureFlagId);
        this.upInsertInstruction({
          kind: InstructionKindEnum.RemovePrerequisiteFeature,
          featureFlagId: p.prerequisiteFeatureFlagId,
          extra: Object.assign({}, p, {selectedFeatureFlag: removedFF})
        });
      }
    });

    prerequisiteFeatures.filter(f => !this.originalFFData.prerequisiteFeatures.find(t => t.prerequisiteFeatureFlagId === f.prerequisiteFeatureFlagId))
                        .forEach(p => {
                          this.upInsertInstruction({
                            kind: InstructionKindEnum.AddPrerequisiteFeature,
                            featureFlagId: p.prerequisiteFeatureFlagId,
                            variationOptionId: p.valueOptionsVariationValue?.localId,
                            extra: p
                          });
                        })
  }

  private preprocessFftuwmtr(fftuwmtr: IFftuwmtrParams[]): IFftuwmtrParams[] {
    return fftuwmtr.map(f => {
      const result = {
        ruleJsonContent: f.ruleJsonContent.map(item => {
          const isSegment = isSegmentRule(item);
          let ruleType: string = isSegment ? 'multi': ruleValueConfig.filter((rule: ruleType) => rule.value === item.operation)[0].type;

          let multipleValue: string[] = [];

          if(ruleType === 'multi' && item.multipleValue === undefined) {
            multipleValue = JSON.parse(item.value || '[]');
          }

          return Object.assign({ multipleValue: multipleValue, type: ruleType }, item);
        })
      };

      return Object.assign({}, f, result);
    });
  }

  private generateFftuwmtrInstruction(fftuwmtr: IFftuwmtrParams[]) {
    fftuwmtr = this.preprocessFftuwmtr(fftuwmtr);

    this.originalFFData.fftuwmtr.forEach((t, idx) => {
      const found = fftuwmtr.find(f => t.ruleId === f.ruleId);
      if (found) {
        // if (JSON.stringify(found.ruleJsonContent) !== JSON.stringify(t.ruleJsonContent)) {
        //   this.upInsertInstruction({
        //     kind: InstructionKindEnum.UpdateRuleClause,
        //     ruleId: found.ruleId,
        //     clauses: found.ruleJsonContent
        //   });
        // }

        if (JSON.stringify(found.ruleJsonContent) !== JSON.stringify(t.ruleJsonContent) || JSON.stringify(found.valueOptionsVariationRuleValues) !== JSON.stringify(t.valueOptionsVariationRuleValues)) {
          this.upInsertInstruction(this.generateRuleInstruction(InstructionKindEnum.UpdateRuleVariationOrRollout, found, idx))
          // let instruction;
          // if (isNotPercentageRollout(found.valueOptionsVariationRuleValues)) { // single value
          //   instruction = {
          //     kind: InstructionKindEnum.UpdateRuleVariationOrRollout,
          //     variationOptionId: found.valueOptionsVariationRuleValues[0].valueOption.localId,
          //   };
          // } else { // percentage rollout
          //     instruction = {
          //       kind: InstructionKindEnum.UpdateRuleVariationOrRollout,
          //       variationOptionId: null,
          //       rolloutVariationPercentage: [...found.valueOptionsVariationRuleValues],
          //       rolloutWeights: found.valueOptionsVariationRuleValues.reduce((acc, curr: IRulePercentageRollout) => {
          //           acc[curr.valueOption.localId] = parseFloat((curr.rolloutPercentage[1] - curr.rolloutPercentage[0]).toFixed(2));
          //           return acc;
          //         }, {})
          //     };
          // }
          // this.upInsertInstruction(instruction);
        }
      } else {
        this.upInsertInstruction(this.generateRuleInstruction(InstructionKindEnum.RemoveRule, t, idx))
      }
    });

    fftuwmtr.filter(f => !this.originalFFData.fftuwmtr.find(t => t.ruleId === f.ruleId))
            .forEach((r, idx) => this.upInsertInstruction(this.generateRuleInstruction(InstructionKindEnum.AddRule, r, this.originalFFData.fftuwmtr.length + idx)));
  }

  private generateRuleInstruction(kind: InstructionKindEnum, rule: IFftuwmtrParams, idx: number): IInstruction {
    const instruction: IInstruction = {
      kind,
      ruleId: rule.ruleId,
      clauses: rule.ruleJsonContent,
      extra: {
        ruleName: `规则${idx + 1}`
      }
    };

    if (isNotPercentageRollout(rule.valueOptionsVariationRuleValues)) {
      instruction['variationOptionId'] = rule.valueOptionsVariationRuleValues[0].valueOption.localId;
    } else {
      instruction['rolloutVariationPercentage'] = [...rule.valueOptionsVariationRuleValues];
      instruction['rolloutWeights'] = rule.valueOptionsVariationRuleValues.reduce((acc, curr: IRulePercentageRollout) => {
        acc[curr.valueOption.localId] = parseFloat((curr.rolloutPercentage[1] - curr.rolloutPercentage[0]).toFixed(2));
        return acc;
      }, {});
    }

    return instruction;
  }

  private generateFallThroughVariationInstruction(fallThroughVariations: IRulePercentageRollout[]) {
    if (JSON.stringify(fallThroughVariations) !== JSON.stringify(this.originalFFData.fallThroughVariations)) {
      let instruction: IInstruction = null;
      if (isNotPercentageRollout(fallThroughVariations)) { // single value
          instruction = {
            kind: InstructionKindEnum.UpdateFallthroughVariationOrRollout,
            variationOptionId: fallThroughVariations[0].valueOption.localId,
          };
      } else { // percentage rollout
          instruction = {
            kind: InstructionKindEnum.UpdateFallthroughVariationOrRollout,
            variationOptionId: null,
            rolloutVariationPercentage: [...fallThroughVariations],
            rolloutWeights: fallThroughVariations.reduce((acc, curr: IRulePercentageRollout) => {
                acc[curr.valueOption.localId] = parseFloat((curr.rolloutPercentage[1] - curr.rolloutPercentage[0]).toFixed(2));
                return acc;
              }, {})
          };
      }

      this.upInsertInstruction(instruction, (a: IInstruction, b: IInstruction) => a.kind === b.kind);
    }
  }

  private generateOffVariationInstruction(variationOptionWhenDisabled: IVariationOption) {
    if (variationOptionWhenDisabled.localId !== this.originalFFData.variationOptionWhenDisabled.localId) {
      this.upInsertInstruction({
        kind: InstructionKindEnum.UpdateOffVariation,
        variationOptionId: variationOptionWhenDisabled.localId,
      });
    }
  }

  private generateUserTargetsInstructions(newTargetIndividuals: {[key: string]: IUserType[]}) {
    for(let key in newTargetIndividuals) {
      const addedUsers = newTargetIndividuals[key].filter(d => !this.originalFFData.targetIndividuals[key].find(t => t.id === d.id)).map(t => t.name);
      const removedUsers = this.originalFFData.targetIndividuals[key].filter(t => !newTargetIndividuals[key].find(d => t.id === d.id)).map(t => t.name);

      const variationOptionId: number = parseInt(key);
      if (addedUsers.length > 0) {
        this.upInsertInstruction({
          kind: InstructionKindEnum.AddUserTargets,
          variationOptionId,
          targetUsers: addedUsers
        });
      }

      if (removedUsers.length > 0) {
        this.upInsertInstruction({
          kind: InstructionKindEnum.RemoveUserTargets,
          variationOptionId,
          targetUsers: removedUsers
        });
      }
    }
  }
}
