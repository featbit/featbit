import { NgModule } from "@angular/core";
import { InstructionComponent } from "@core/components/change-list-v2/instructions/instruction.component";
import { InstructionDirective } from "@core/components/change-list-v2/instructions/instruction.directive";
import { TurnFlagOnComponent } from "@core/components/change-list-v2/instructions/turn-flag-on/turn-flag-on.component";
import { ArchiveFlagComponent } from "@core/components/change-list-v2/instructions/archive-flag/archive-flag.component";
import { NzTagModule } from "ng-zorro-antd/tag";
import {
  TurnFlagOffComponent
} from "@core/components/change-list-v2/instructions/turn-flag-off/turn-flag-off.component";
import { ChangeListV2Component } from "@core/components/change-list-v2/change-list-v2.component";
import { CommonModule } from "@angular/common";
import { RestoreFlagComponent } from "@core/components/change-list-v2/instructions/restore-flag/restore-flag.component";
import { UpdateNameComponent } from "@core/components/change-list-v2/instructions/update-name/update-name.component";
import {
  UpdateDescriptionComponent
} from "@core/components/change-list-v2/instructions/update-description/update-description.component";
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
} from "@core/components/change-list-v2/instructions/UpdateDefaultRuleDispatchKey/update-default-rule-dispatch-key.component";
import {
  UpdateRuleVariationOrRollout
} from "@core/components/change-list-v2/instructions/UpdateRuleVariationOrRollout/update-rule-variation-or-rollout.component";

@NgModule({
  declarations: [
    ChangeListV2Component,
    InstructionComponent,
    InstructionDirective,
    TurnFlagOnComponent,
    TurnFlagOffComponent,
    ArchiveFlagComponent,
    RestoreFlagComponent,
    UpdateNameComponent,
    UpdateDescriptionComponent,
    AddTagsComponent,
    RemoveTagsComponent,
    RemoveTargetUsersComponent,
    AddTargetUsersComponent,
    UpdateVariationTypeComponent,
    AddVariationComponent,
    RemoveVariationComponent,
    UpdateVariationComponent,
    UpdateOffVariationComponent,
    UpdateDefaultRuleDispatchKeyComponent,
    UpdateRuleVariationOrRollout
  ],
  imports: [
    CommonModule,
    NzTagModule
  ],
  exports: [
    ChangeListV2Component
  ]
})
export class ChangeListV2Module { }
