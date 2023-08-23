import { Component, Input } from "@angular/core";
import {
  ICategoryInstruction, IChangeListParam,
  IInstruction,
  IInstructionKindComponent,
  IRuleId,
  IRuleInstructionGroup
} from "@core/components/change-list-v2/instructions/types";
import { CategoryEnum, instructionCategories, InstructionKindEnum, RuleInstructionKinkOpEnum } from "@core/components/change-list-v2/constants";
import { IRule } from "@shared/rules";

@Component({
  selector: 'change-list-v2',
  templateUrl: './change-list-v2.component.html'
})
export class ChangeListV2Component {

  private notUpdateRuleInstructions = [
    InstructionKindEnum.AddRule,
    InstructionKindEnum.RemoveRule,
    InstructionKindEnum.SetRules
  ];

  categories: ICategoryInstruction[] = [];

  constructor(
  ) { }

  @Input()
  set param (param: IChangeListParam) {
    this.categories = instructionCategories.map((category: ICategoryInstruction) => {
      const { label } = category;

      const instructions = param.instructions
        .filter((instruction: IInstruction) => category.instructions.find((i: IInstructionKindComponent) => i.kind === instruction.kind))
        .map((instruction: IInstruction) => {
          const i = category.instructions.find((i: IInstructionKindComponent) => i.kind === instruction.kind);

          return {
            ...i,
            value: instruction.value,
            previous: param.previous,
            current: param.current
          }
        });

      if (category.category !== CategoryEnum.Rules) {
        return { label, instructions };
      }

      // group add rule instructions
      const addRuleStr = $localize`:@@common.add-rule:Add rule`;
      let addRuleInstructions: IRuleInstructionGroup[] = instructions
        .filter((ins) => ins.kind === InstructionKindEnum.AddRule)
        .map((ins) => {
          const rule = ins.value as IRule;

          return {
            label: `${addRuleStr} <span class="rule-name">${rule.name}</span>`,
            op: RuleInstructionKinkOpEnum.Create,
            instructions: [ins]
          }
        });

      // group remove rule instructions
      const removeRuleStr = $localize`:@@common.remove-rule:Remove rule`;
      const removeRuleInstructions: IRuleInstructionGroup[] = instructions
        .filter((ins) => ins.kind == InstructionKindEnum.RemoveRule)
        .map((ins) => {
          const ruleId = ins.value as string;
          const rule = ins.previous.rules.find((r) => r.id === ruleId);

          return {
            label: `${removeRuleStr} <span class="rule-name">${rule.name}</span>`,
            op: RuleInstructionKinkOpEnum.Remove,
            instructions: [{
              ...ins,
              value: rule
            }]
          }
        });

      const setRuleInstructions = instructions
        .filter((ins) => ins.kind === InstructionKindEnum.SetRules)
        .flatMap((ins) => {
          const rules = ins.value as IRule[];

          if (rules.length === 0) {
            return ins.previous.rules.map((rule) => ({
              label: `${removeRuleStr} <span class="rule-name">${rule.name}</span>`,
              op: RuleInstructionKinkOpEnum.Remove,
              instructions: [{
                ...ins,
                kind: InstructionKindEnum.DescribeRule,
                value: rule
              }]
            }));
          }
          return rules.map((rule) => ({
            label: `${addRuleStr} <span class="rule-name">${rule.name}</span>`,
            op: RuleInstructionKinkOpEnum.Create,
            instructions: [{
              ...ins,
              kind: InstructionKindEnum.DescribeRule,
              value: rule
            }]
          }));
        });

      // group update rule instructions
      const updateRuleStr = $localize`:@@common.update-rule:Update rule`;
      const updateRuleInstructions: IRuleInstructionGroup[] = Object.values(instructions
        .filter((ins) => !this.notUpdateRuleInstructions.includes(ins.kind))
        .map((ins) => {
          const ruleId = ins.value as IRuleId;
          const rule = ins.current.rules.find((r) => r.id === ruleId.ruleId);

          return {
            label: `${updateRuleStr} <span class="rule-name">${rule.name}</span>`,
            op: RuleInstructionKinkOpEnum.Update,
            instructions: [ins]
          }
        })
        .reduce((acc, cur) => {
          const { label } = cur;
          if (acc[label]) {
            acc[label].instructions = [...acc[label].instructions, ...cur.instructions];
          } else {
            acc[label] = cur;
          }

          return acc;
        }, {}));

      return { label, groups: [
        ...addRuleInstructions,
        ...removeRuleInstructions,
        ...setRuleInstructions,
        ...updateRuleInstructions
      ]};

    }).filter((category: ICategoryInstruction) => category.instructions?.length > 0 || category.groups?.length > 0);
  }
}
