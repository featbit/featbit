import { Component, Input } from "@angular/core";
import {
  ICategoryInstruction, IChangeListParam,
  IInstruction,
  IInstructionKindComponent,
  IRule,
  IRuleId,
  IRuleInstructionGroup
} from "@core/components/change-list-v2/instructions/types";
import { CategoryEnum, instructionCategories, InstructionKindEnum, RuleInstructionKinkOpEnum } from "@core/components/change-list-v2/constants";

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
      const instructions = category.instructions.filter((instruction: IInstructionKindComponent) => {
        const i = param.instructions.find((i: IInstruction) => i.kind === instruction.kind);
        instruction.value = i?.value;
        instruction.previous = param.previous;
        instruction.current = param.current;
        return !!i;
      });

      if (category.category !== CategoryEnum.Rules) {
        return { label, instructions };
      }

      // group add rule instructions
      const addRuleStr = $localize`:@@common.add-rule:Add rule`;
      let addRuleInstructions: IRuleInstructionGroup[] = instructions.filter((ins) => ins.kind === InstructionKindEnum.AddRule).map((ins) => {
        const rule = ins.value as IRule;

        return {
          label: `${addRuleStr} <span>${rule.name}</span>`,
          op: RuleInstructionKinkOpEnum.Create,
          instructions: [ins]
        }
      });

      addRuleInstructions = [
        ...addRuleInstructions,
        ...instructions.filter((ins) => ins.kind === InstructionKindEnum.SetRules).flatMap((ins) => {
          const rules = ins.value as IRule[];

          return rules.map((rule) => ({
            label: `${addRuleStr} <span>${rule.name}</span>`,
            op: RuleInstructionKinkOpEnum.Create,
            instructions: [ins]
          }));
        })
      ];

      // udpate rule name
    
      // group remove rule instructions
      const removeRuleStr = $localize`:@@common.remove-rule:Remove rule`;
      const removeRuleInstructions: IRuleInstructionGroup[] = instructions.filter((ins) => ins.kind == InstructionKindEnum.RemoveRule).map((ins) => {
        const ruleId = ins.value as string;
        const rule = ins.previous.rules.find((r) => r.id === ruleId); 

        return {
          label: `${removeRuleStr} <span>${rule.name}</span>`,
          op: RuleInstructionKinkOpEnum.Remove,
          instructions: [ins]
        }
      });

      // group update rule instructions
      const updateRuleStr = $localize`:@@common.update-rule:Update rule`;
      const updateRuleInstructions: IRuleInstructionGroup[] = instructions.filter((ins) => !this.notUpdateRuleInstructions.includes(ins.kind)).map((ins) => {
        const ruleId = ins.value as IRuleId;
        const rule = ins.previous.rules.find((r) => r.id === ruleId.ruleId); 

        return {
          label: `${updateRuleStr} <span>${rule.name}</span>`,
          op: RuleInstructionKinkOpEnum.Update,
          instructions: [ins]
        }
      });
      
      return { label, groups: [
        ...addRuleInstructions,
        ...removeRuleInstructions,
        ...updateRuleInstructions
      ]};
      
    }).filter((category: ICategoryInstruction) => category.instructions.length > 0);
  }
}
