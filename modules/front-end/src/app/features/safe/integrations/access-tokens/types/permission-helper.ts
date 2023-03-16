import { IamPolicyAction, IPolicyStatement, permissionActions } from "@shared/policy";
import { uuidv4 } from "@utils/index";

export interface IPermissionStatementGroup {
  allChecked: boolean,
  indeterminate: boolean,
  statements: IPermissionStatement[]
}

export interface IPermissionStatement extends IPolicyStatement {
  action: IamPolicyAction;
  checked: boolean
}

export const preProcessPermissions = (statements: IPolicyStatement[]): { [key: string]: IPermissionStatementGroup} => {
  return statements.flatMap((statement) => {
    const {effect, resourceType, resources} = statement;
    return statement.actions.map((action) => ({
      effect,
      resourceType,
      resources,
      action: permissionActions[action]
    }));
  }).filter(({effect, resourceType, resources, action}) => action && action.isOpenAPIApplicable)
    .reduce((acc, cur) => {
      acc[cur.resourceType] = acc[cur.resourceType] || { allChecked: true, indeterminate: false, statements: [] };
      const idx = acc[cur.resourceType].statements.findIndex((api) => api.effect ===cur.effect && api.action.name ===cur.action.name && api.effect === 'allow');

      if (idx !== -1) { // duplicate exists
        const statement = acc[cur.resourceType].statements[idx];
        const resources = [...statement.resources, ...cur.resources];
        acc[cur.resourceType].statements.splice(idx, 1, { ...cur, checked: true, resources: resources.filter((resource, idx) => resources.indexOf(resource) === idx)});
      } else {
        acc[cur.resourceType].statements.push({...cur, checked: true});
      }

      return acc;
    }, {});
}

export const postProcessPermissions = (permissions: { [key: string]: IPermissionStatementGroup}): IPolicyStatement[] => {
  return Object.keys(permissions)
    .flatMap((property) => permissions[property].statements)
    .filter((statement) => statement.checked)
    .map(({id, effect, resourceType, resources, action}) => ({
      id: uuidv4(),
      effect,
      resourceType,
      resources,
      actions: [action.name]
    }));
}
