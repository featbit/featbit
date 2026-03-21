import {
  generalResourceRNPattern,
  IamPolicyAction,
  IPolicyStatement,
  permissionActions,
  ResourceType,
} from "@shared/policy";
import { uuidv4 } from "@utils/index";

export interface ResourceTypeExtension extends ResourceType {
  isConfigurable: boolean;
  isResourceEditorVisible: boolean;
}

export class PermissionStatementGroup {
  currentResource: string = '';
  currentResourceIndex: number = 0;

  allChecked: boolean = false;
  indeterminate: boolean = false;
  isAllResources: boolean = true;

  constructor(
    public resourceType: string,
    public resources: string[],
    public statements: IPermissionStatement[],
    ) {
  }

  saveResource = (rsc: string) => {
    if(this.currentResourceIndex > this.resources.length - 1) { // add new item
      this.resources = [...this.resources, rsc];
    } else { // replace existing item
      this.resources = this.resources.map((item, i) => i === this.currentResourceIndex ? rsc : item);
    }
  }

  onIsAllResourcesChange = (isAllResources: boolean) => {
    if (isAllResources) {
      this.resources = [generalResourceRNPattern[this.resourceType]];
    } else {
      this.resources = [];
    }
  }

  removeResource = (rsc: string) => {
    this.resources = this.resources.filter(resource => resource !== rsc);
  };
}

export interface IPermissionStatement extends IPolicyStatement {
  action: IamPolicyAction;
  checked: boolean
}

export const preProcessPermissions = (statements: IPolicyStatement[]): { [key: string]: PermissionStatementGroup} => {
  console.log(statements);
  return statements.flatMap((statement) => {
    const {effect, resourceType, resources} = statement;
    return statement.actions.map((action) => {
      const pa = Object.values(permissionActions)
                                .find(act => act.resourceType === resourceType && act.name === action);

      return {
       effect,
       resourceType,
       resources,
       action: pa
      };
    });
  }).filter(({action}) => action && action.isOpenAPIApplicable)
    .reduce((acc, cur) => {
      acc[cur.resourceType] = acc[cur.resourceType] || new PermissionStatementGroup(cur.resourceType, [], []);

      // statements
      const idx = acc[cur.resourceType].statements.findIndex((statement) => statement.effect === cur.effect && statement.action.name === cur.action.name && statement.effect === 'allow');
      if (idx !== -1) { // duplicate exists
        const statement = acc[cur.resourceType].statements[idx];
        const resources = [...statement.resources, ...cur.resources];
        acc[cur.resourceType].resources = resources;
        acc[cur.resourceType].statements.splice(idx, 1, { ...cur, checked: true, resources: resources.filter((resource, idx) => resources.indexOf(resource) === idx)});
      } else {
        acc[cur.resourceType].resources = [...cur.resources];
        acc[cur.resourceType].statements.push({...cur, checked: true});
      }

      acc[cur.resourceType].isAllResources = acc[cur.resourceType].resources.length === 1 && acc[cur.resourceType].resources[0] === generalResourceRNPattern[cur.resourceType];
      return acc;
    }, {});
}

export const postProcessPermissions = (permissions: { [key: string]: PermissionStatementGroup}): IPolicyStatement[] => {
  return Object.values(permissions)
  .flatMap(permission => {
      const checkedStatements = permission.statements.filter((statement) => statement.checked);
      if (checkedStatements.length === 0) {
        return [];
      }

      const { resources } = permission;
      const { effect, resourceType } = checkedStatements[0];
      const actions = checkedStatements.map(statement => statement.action.name);

      return [{
        id: uuidv4(),
        effect,
        resourceType,
        resources,
        actions
      }];
  });
}
