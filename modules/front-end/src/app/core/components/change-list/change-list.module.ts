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
  UpdateTargetUsersComponent
} from "@core/components/change-list/instructions/update-target-users/update-target-users.component";
import { UpdateTagsComponent } from "@core/components/change-list/instructions/update-tags/update-tags.component";
import {
  UpdateVariationTypeComponent
} from "@core/components/change-list/instructions/update-variation-type/update-variation-type.component";
import {
  ChangeVariationsComponent
} from "@core/components/change-list/instructions/change-variations/change-variations.component";
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
  UpdateTargetUsersForSegmentComponent
} from "@core/components/change-list/instructions/update-target-users-for-segment/update-target-users-for-segment.component";

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
    UpdateTargetUsersComponent,
    UpdateTagsComponent,
    UpdateVariationTypeComponent,
    ChangeVariationsComponent,
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
    UpdateTargetUsersForSegmentComponent
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
