import { NgModule } from "@angular/core";
import { InstructionComponent } from "@core/components/change-list/instructions/instruction.component";
import { InstructionDirective } from "@core/components/change-list/instructions/instruction.directive";
import { TurnFlagOnComponent } from "@core/components/change-list/instructions/turn-flag-on/turn-flag-on.component";
import { ArchiveFlagComponent } from "@core/components/change-list/instructions/archive-flag/archive-flag.component";
import { NzTagModule } from "ng-zorro-antd/tag";
import {
  TurnFlagOffComponent
} from "@core/components/change-list/instructions/turn-flag-off/turn-flag-off.component";
import { ChangeListComponent } from "@core/components/change-list/change-list.component";
import { CommonModule } from "@angular/common";
import { RestoreFlagComponent } from "@core/components/change-list/instructions/restore-flag/restore-flag.component";
import { UpdateNameComponent } from "@core/components/change-list/instructions/update-name/update-name.component";
import {
  UpdateDescriptionComponent
} from "@core/components/change-list/instructions/update-description/update-description.component";
import {
  RemoveTargetUsersComponent
} from "@core/components/change-list/instructions/remove-target-users/remove-target-users.component";
import {
  AddTargetUsersComponent
} from "@core/components/change-list/instructions/add-target-users/add-target-users.component";
import { UpdateTagsComponent } from "@core/components/change-list/instructions/update-tags/update-tags.component";
import {
  UpdateVariationTypeComponent
} from "@core/components/change-list/instructions/update-variation-type/update-variation-type.component";
import {
  AddVariationComponent
} from "@core/components/change-list/instructions/add-variation/add-variation.component";
import {
  RemoveVariationComponent
} from "@core/components/change-list/instructions/remove-variation/remove-variation.component";
import {
  UpdateVariationComponent
} from "@core/components/change-list/instructions/update-variation/update-variation.component";
import {
  UpdateOffVariationComponent
} from "@core/components/change-list/instructions/update-off-variation/update-off-variation.component";
import {
  UpdateDefaultRuleDispatchKeyComponent
} from "@core/components/change-list/instructions/update-default-rule-dispatch-key/update-default-rule-dispatch-key.component";
import {
  UpdateRuleVariationOrRolloutComponent
} from "@core/components/change-list/instructions/update-rule-variation-or-rollout/update-rule-variation-or-rollout.component";
import { PipesModule } from "@core/pipes/pipes.module";
import {
  UpdateRuleDispatchKeyComponent
} from "@core/components/change-list/instructions/update-rule-dispatch-key/update-rule-dispatch-key.component";
import {
  UpdateRuleNameComponent
} from "@core/components/change-list/instructions/update-rule-name/update-rule-name.component";
import {
  DescribeRuleComponent
} from "@core/components/change-list/instructions/describe-rule/describe-rule.component";
import {
  AddRuleConditionsComponent
} from "@core/components/change-list/instructions/add-rule-conditions/add-rule-conditions.component";
import {
  RemoveRuleConditionsComponent
} from "@core/components/change-list/instructions/remove-rule-condition/remove-rule-conditions.component";
import {
  UpdateRuleConditionComponent
} from "@core/components/change-list/instructions/update-rule-condition/update-rule-condition.component";
import {
  UpdateValuesOfRuleConditionComponent
} from "@core/components/change-list/instructions/update-values-of-rule-condition/update-values-of-rule-condition.component";
import { NzCollapseModule } from "ng-zorro-antd/collapse";
import {
  AddTargetUsersToIncludedComponent
} from "@core/components/change-list/instructions/add-target-users-to-included/add-target-users-to-included.component";
import {
  AddTargetUsersToExcludedComponent
} from "@core/components/change-list/instructions/add-target-users-to-excluded/add-target-users-to-excluded.component";
import {
  RemoveTargetUsersFromIncludedComponent
} from "@core/components/change-list/instructions/remove-target-users-from-included/remove-target-users-from-included.component";
import {
  RemoveTargetUsersFromExcludedComponent
} from "@core/components/change-list/instructions/remove-target-users-from-excluded/remove-target-users-from-excluded.component";

@NgModule({
  declarations: [
    ChangeListComponent,
    InstructionComponent,
    InstructionDirective,
    TurnFlagOnComponent,
    TurnFlagOffComponent,
    ArchiveFlagComponent,
    RestoreFlagComponent,
    UpdateNameComponent,
    UpdateDescriptionComponent,
    UpdateTagsComponent,
    RemoveTargetUsersComponent,
    AddTargetUsersComponent,
    UpdateVariationTypeComponent,
    AddVariationComponent,
    RemoveVariationComponent,
    UpdateVariationComponent,
    UpdateOffVariationComponent,
    UpdateDefaultRuleDispatchKeyComponent,
    UpdateRuleVariationOrRolloutComponent,
    UpdateRuleDispatchKeyComponent,
    UpdateRuleNameComponent,
    DescribeRuleComponent,
    AddRuleConditionsComponent,
    RemoveRuleConditionsComponent,
    UpdateRuleConditionComponent,
    UpdateValuesOfRuleConditionComponent,
    AddTargetUsersToIncludedComponent,
    AddTargetUsersToExcludedComponent,
    RemoveTargetUsersFromIncludedComponent,
    RemoveTargetUsersFromExcludedComponent
  ],
  imports: [
    CommonModule,
    NzTagModule,
    PipesModule,
    NzCollapseModule
  ],
  exports: [
    ChangeListComponent
  ]
})
export class ChangeListModule { }
