import {Component, EventEmitter, Input, Output} from '@angular/core';
import {
  EffectEnum,
  IamPolicyAction,
  IPolicyStatement,
  isResourceGeneral, permissionActions,
  Resource,
  resourcesTypes,
  ResourceType
} from "@shared/policy";
import {deepCopy, encodeURIComponentFfc, uuidv4} from "@utils/index";
import { IPolicy, PolicyTypeEnum } from "@features/safe/iam/types/policy";
import {NzMessageService} from "ng-zorro-antd/message";
import {PolicyService} from "@services/policy.service";
import {Router} from "@angular/router";

class PolicyStatementViewModel {
  id: string;
  resourceType?: ResourceType = null;
  effect: EffectEnum = EffectEnum.Allow;
  availableActions: IamPolicyAction[] = [];

  compareResourceType = (o1: ResourceType, o2: ResourceType) => {
    return o1 && o2 && o1.type === o2.type;
  }

  constructor(statement?: IPolicyStatement) {
    this.resourceType = resourcesTypes[0];
    if (statement) {
      this.id = statement.id;
      this.resourceType = resourcesTypes.find(rt => rt.type === statement.resourceType) || null;
      this.effect = statement.effect === 'allow' ? EffectEnum.Allow : EffectEnum.Deny;

      const allActions = [...Object.values(permissionActions)];
      this.selectedActions = statement.actions.map(act => {
        const find = allActions.find(a => act === a.name);
        return find || act as unknown as IamPolicyAction;
      });

      this.selectedResources = statement.resources.map(rsc => ({id: uuidv4(), name: rsc, rn: rsc, type: this.resourceType.type}));

      // All the resources here are the same type, and if it's general type, resources only contains one element
      const isGeneralResource = isResourceGeneral(this.resourceType?.type, statement.resources[0]);
      this.availableActions = [...Object.values(permissionActions)].filter((rs) => rs.resourceType === this.resourceType?.type && (isGeneralResource || rs.isSpecificApplicable));
    } else {
      this.id = uuidv4();
      this.effect = EffectEnum.Allow;
      this.selectedActions = [];
      this.selectedResources = [];
      this.availableActions =[];
    }
  }

  onResourceTypeChange(){
    this.selectedActions = [];
    this.selectedResources = [];
    this.availableActions = [];
  }

  selectedActions: IamPolicyAction[] = [];
  onSelectedActionsChange(actions: IamPolicyAction[]) {
    this.selectedActions = [...actions];
  }

  selectedResources: Resource[] = [];
  onSelectedResourcesChange(resources: Resource[]) {
    this.selectedResources = [...resources];
    // All the resources here are the same type, and if it's general type, resources only contains one element
    const isGeneralResource = isResourceGeneral(resources[0].type, resources[0].rn);

    this.availableActions = [...Object.values(permissionActions)].filter((rs) => rs.resourceType === this.resourceType?.type && (isGeneralResource || rs.isSpecificApplicable));
  }

  getOutput(): IPolicyStatement {
    return {
      id: this.id,
      resourceType: this.resourceType.type,
      effect: this.effect,
      actions: this.selectedActions.map(act => act.name),
      resources: this.selectedResources.map(rsc => rsc.rn)
    }
  }

  isResourcesInvalid: boolean = false;
  isActionsInvalid: boolean = false;
  validate() {
    this.isResourcesInvalid = this.selectedResources.length === 0;
    this.isActionsInvalid = this.selectedActions.length === 0;
    return this.isResourcesInvalid || this.isActionsInvalid;
  }
}

@Component({
  selector: 'iam-policy-editor',
  templateUrl: './policy-editor.component.html',
  styleUrls: ['./policy-editor.component.less']
})
export class PolicyEditorComponent {

  resourcesTypes: ResourceType[] = resourcesTypes;
  statements: PolicyStatementViewModel[] = [];
  readonly: boolean; // true if SysManaged

  constructor(
    private router: Router,
    private message: NzMessageService,
    private policyService: PolicyService
  ) { }

  @Output()
  saveStatementsEvent = new EventEmitter<IPolicyStatement[]>();

  private _policy: IPolicy;
  @Input('policy')
  set _(policy: IPolicy) {
    if (policy) {
      this._policy = deepCopy(policy);
      this.readonly = policy.type === PolicyTypeEnum.SysManaged;
      this.statements = policy.statements.map(statement => new PolicyStatementViewModel(statement));
    }
  }

  copyPolicy() {
    const { name, description, statements } = this._policy;

    this.policyService.create(`${name}_copy`, description).subscribe(
      (p: IPolicy) => {

        this.policyService.updateStatements(p.id, statements).subscribe(() => {
          this.message.success($localize `:@@common.copy-success:Copied`);
          this.router.navigateByUrl(`/iam/policies/${encodeURIComponentFfc(p.id)}/permission`);
        }, _ => this.message.error($localize `:@@common.operation-failed:Operation failed`));
      },
      _ => {
        this.message.success($localize `:@@common.operation-failed:Operation failed`);
      }
    )
  }

  saveStatements() {
    if (this.readonly) {
      this.message.warning($localize `:@@iam.policies.details.managed-policies-cannot-be-modified:System Managed policies cannot be modified. If needed, you can make a copy and modify it for your own needs.`);
      return;
    }

    const isInvalid = this.statements.map(statement => statement.validate()).find(v => v);
    if (isInvalid) {
      this.message.error($localize `:@@iam.policies.details.assure-resource-operation:Make sure resource and operation are set for all permissions`);
    } else {
      const payload = this.statements.map(statement => statement.getOutput());
      this.saveStatementsEvent.emit(payload);
    }
  }

  addStatement() {
    this.statements = [...this.statements, new PolicyStatementViewModel()];
  }

  removeStatement(statement: PolicyStatementViewModel) {
    this.statements = this.statements.filter(s => s.id !== statement.id);
  }
}
