import { TurnFlagOnComponent } from "@core/components/change-list-v2/instructions/turn-flag-on/turn-flag-on.component";
import { ICategoryInstruction } from "@core/components/change-list-v2/instructions/types";
import { ArchiveFlagComponent } from "@core/components/change-list-v2/instructions/archive-flag/archive-flag.component";
import { TurnFlagOffComponent } from "@core/components/change-list-v2/instructions/turn-flag-off/turn-flag-off.component";
import { RestoreFlagComponent } from "@core/components/change-list-v2/instructions/restore-flag/restore-flag.component";
import { UpdateNameComponent } from "@core/components/change-list-v2/instructions/update-name/update-name.component";
import { UpdateDescriptionComponent } from "@core/components/change-list-v2/instructions/update-description/update-description.component";
import {
  RemoveTargetUsersComponent
} from "@core/components/change-list-v2/instructions/remove-target-users/remove-target-users.component";
import {
  AddTargetUsersComponent
} from "@core/components/change-list-v2/instructions/add-target-users/add-target-users.component";
import { AddTagsComponent } from "@core/components/change-list-v2/instructions/add-tags/add-tags.component";
import { RemoveTagsComponent } from "@core/components/change-list-v2/instructions/remove-tags/remove-tags.component";
import {
  UpdateVariationTypeComponent
} from "@core/components/change-list-v2/instructions/update-variation-type/update-variation-type.component";
import {
  AddVariationComponent
} from "@core/components/change-list-v2/instructions/add-variation/add-variation.component";
import {
  RemoveVariationComponent
} from "@core/components/change-list-v2/instructions/remove-variation/remove-variation.component";
import {
  UpdateVariationComponent
} from "@core/components/change-list-v2/instructions/update-variation/update-variation.component";
import {
  UpdateOffVariationComponent
} from "@core/components/change-list-v2/instructions/update-off-variation/update-off-variation.component";
import {
  UpdateDefaultRuleDispatchKeyComponent
} from "@core/components/change-list-v2/instructions/update-default-rule-dispatch-key/update-default-rule-dispatch-key.component";
import {
  UpdateRuleVariationOrRolloutComponent
} from "@core/components/change-list-v2/instructions/update-rule-variation-or-rollout/update-rule-variation-or-rollout.component";
import {
  UpdateRuleDispatchKeyComponent
} from "@core/components/change-list-v2/instructions/update-rule-dispatch-key/update-rule-dispatch-key.component";
import {
  UpdateRuleNameComponent
} from "@core/components/change-list-v2/instructions/update-rule-name/update-rule-name.component";
import {
  DescribeRuleComponent
} from "@core/components/change-list-v2/instructions/describe-rule/describe-rule.component";
import {
  AddRuleConditionsComponent
} from "@core/components/change-list-v2/instructions/add-rule-conditions/add-rule-conditions.component";
import {
  RemoveRuleConditionsComponent
} from "@core/components/change-list-v2/instructions/remove-rule-condition/remove-rule-conditions.component";
import {
  UpdateRuleConditionComponent
} from "@core/components/change-list-v2/instructions/update-rule-condition/update-rule-condition.component";
import {
  AddValuesToRuleConditionComponent
} from "@core/components/change-list-v2/instructions/add-values-to-rule-condition/add-values-to-rule-condition.component";
import {
  RemoveValuesFromRuleConditionComponent
} from "@core/components/change-list-v2/instructions/remove-values-from-rule-condition/remove-values-from-rule-condition.component";
import {
  AddTargetUsersToIncludedComponent
} from "@core/components/change-list-v2/instructions/add-target-users-to-included/add-target-users-to-included.component";
import {
  RemoveTargetUsersFromIncludedComponent
} from "@core/components/change-list-v2/instructions/remove-target-users-from-included/remove-target-users-from-included.component";
import {
  RemoveTargetUsersFromExcludedComponent
} from "@core/components/change-list-v2/instructions/remove-target-users-from-excluded/remove-target-users-from-excluded.component";
import {
  AddTargetUsersToExcludedComponent
} from "@core/components/change-list-v2/instructions/add-target-users-to-excluded/add-target-users-to-excluded.component";

export enum InstructionKindEnum {
  // Settings
  TurnFlagOn = 'TurnFlagOn',
  TurnFlagOff = 'TurnFlagOff',
  ArchiveFlag = 'ArchiveFlag',
  RestoreFlag = 'RestoreFlag',
  UpdateName = 'UpdateName',
  AddTags = 'AddTags',
  RemoveTags = 'RemoveTags',
  UpdateDescription = 'UpdateDescription',

  // Target users
  RemoveTargetUsers = 'RemoveTargetUsers',
  AddTargetUsers = 'AddTargetUsers',
  RemoveTargetUsersFromIncluded = "RemoveTargetUsersFromIncluded",
  AddTargetUsersToIncluded = "AddTargetUsersToIncluded",
  AddTargetUsersToExcluded = "AddTargetUsersToExcluded",
  RemoveTargetUsersFromExcluded = "RemoveTargetUsersFromExcluded",

  // Variations
  UpdateVariationType = 'UpdateVariationType',
  RemoveVariation = 'RemoveVariation',
  AddVariation = 'AddVariation',
  UpdateVariation = 'UpdateVariation',

  // Off variation
  UpdateOffVariation = 'UpdateDisabledVariation',

  // Default rule
  UpdateDefaultRuleDispatchKey = 'UpdateDefaultRuleDispatchKey',
  UpdateDefaultRuleVariationOrRollouts = 'UpdateDefaultRuleVariationOrRollouts',

  // Rules
  AddRule = 'AddRule', // DescribeRule would be used finally
  RemoveRule = 'RemoveRule', // DescribeRule would be used finally
  SetRules = 'SetRules', // AddRule or RemoveRule would be used finally
  DescribeRule = 'DescribeRule',
  UpdateRuleName = 'UpdateRuleName',
  UpdateRuleDispatchKey = 'UpdateRuleDispatchKey',
  AddRuleConditions = 'AddRuleConditions',
  RemoveRuleConditions = 'RemoveRuleConditions',
  UpdateRuleCondition = 'UpdateRuleCondition',
  AddValuesToRuleCondition = 'AddValuesToRuleCondition',
  RemoveValuesFromRuleCondition = 'RemoveValuesFromRuleCondition',
  UpdateRuleVariationOrRollouts = 'UpdateRuleVariationOrRollouts'
}

export enum CategoryEnum {
  Settings = 'settings',
  TargetUsers = 'target-users',
  DefaultRule = 'default-rule',
  OffVariation = 'off-variation',
  Variations = 'variations',
  Rules = 'rules'
}

export enum RuleInstructionKinkOpEnum {
  Create = 1,
  Remove = 2,
  Update = 3
}

export const instructionCategories: ICategoryInstruction[] = [
  {
    category: CategoryEnum.Settings,
    label: $localize`:@@common.settings:Settings`,
    instructions: [
      { component: TurnFlagOnComponent, kind: InstructionKindEnum.TurnFlagOn },
      { component: TurnFlagOffComponent, kind: InstructionKindEnum.TurnFlagOff },
      { component: ArchiveFlagComponent, kind: InstructionKindEnum.ArchiveFlag },
      { component: RestoreFlagComponent, kind: InstructionKindEnum.RestoreFlag },
      { component: UpdateNameComponent, kind: InstructionKindEnum.UpdateName },
      { component: UpdateDescriptionComponent, kind: InstructionKindEnum.UpdateDescription },
      { component: AddTagsComponent, kind: InstructionKindEnum.AddTags },
      { component: RemoveTagsComponent, kind: InstructionKindEnum.RemoveTags },
    ]
  },
  {
    category: CategoryEnum.DefaultRule,
    label: $localize`:@@common.default-rule:Default rule`,
    instructions: [
      { component: UpdateRuleVariationOrRolloutComponent, kind: InstructionKindEnum.UpdateDefaultRuleVariationOrRollouts },
      { component: UpdateDefaultRuleDispatchKeyComponent, kind: InstructionKindEnum.UpdateDefaultRuleDispatchKey },
    ]
  },
  {
    category: CategoryEnum.TargetUsers,
    label: $localize`:@@common.target-users:Individual Targeting`,
    instructions: [
      { component: RemoveTargetUsersComponent, kind: InstructionKindEnum.RemoveTargetUsers },
      { component: AddTargetUsersComponent, kind: InstructionKindEnum.AddTargetUsers },
      { component: AddTargetUsersToIncludedComponent, kind: InstructionKindEnum.AddTargetUsersToIncluded },
      { component: RemoveTargetUsersFromIncludedComponent, kind: InstructionKindEnum.RemoveTargetUsersFromIncluded },
      { component: AddTargetUsersToExcludedComponent, kind: InstructionKindEnum.AddTargetUsersToExcluded },
      { component: RemoveTargetUsersFromExcludedComponent, kind: InstructionKindEnum.RemoveTargetUsersFromExcluded },
    ]
  },
  {
    category: CategoryEnum.OffVariation,
    label: $localize`:@@common.off-variation:Off variation`,
    instructions: [
      { component: UpdateOffVariationComponent, kind: InstructionKindEnum.UpdateOffVariation },
    ]
  },
  {
    category: CategoryEnum.Rules,
    label: $localize`:@@common.rules:Rules`,
    instructions: [
      { component: UpdateRuleNameComponent, kind: InstructionKindEnum.UpdateRuleName },
      { component: DescribeRuleComponent, kind: InstructionKindEnum.AddRule },
      { component: DescribeRuleComponent, kind: InstructionKindEnum.RemoveRule },
      { component: DescribeRuleComponent, kind: InstructionKindEnum.SetRules },
      { component: AddRuleConditionsComponent, kind: InstructionKindEnum.AddRuleConditions },
      { component: RemoveRuleConditionsComponent, kind: InstructionKindEnum.RemoveRuleConditions },
      { component: UpdateRuleConditionComponent, kind: InstructionKindEnum.UpdateRuleCondition },
      { component: AddValuesToRuleConditionComponent, kind: InstructionKindEnum.AddValuesToRuleCondition },
      { component: RemoveValuesFromRuleConditionComponent, kind: InstructionKindEnum.RemoveValuesFromRuleCondition },
      { component: UpdateRuleVariationOrRolloutComponent, kind: InstructionKindEnum.UpdateRuleVariationOrRollouts },
      { component: UpdateRuleDispatchKeyComponent, kind: InstructionKindEnum.UpdateRuleDispatchKey },
    ]
  },
  {
    category: CategoryEnum.Variations,
    label: $localize`:@@common.variations:Variations`,
    instructions: [
      { component: UpdateVariationTypeComponent, kind: InstructionKindEnum.UpdateVariationType },
      { component: AddVariationComponent, kind: InstructionKindEnum.AddVariation },
      { component: RemoveVariationComponent, kind: InstructionKindEnum.RemoveVariation },
      { component: UpdateVariationComponent, kind: InstructionKindEnum.UpdateVariation },
    ]
  }
];
