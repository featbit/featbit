import {Injectable} from "@angular/core";
import {lastValueFrom} from "rxjs";
import {IPolicy, IPolicyStatement} from "@features/safe/iam/types/policy";
import {MemberService} from "@services/member.service";
import {EffectEnum, ResourceTypeEnum} from "@features/safe/iam/components/policy-editor/types";

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  policies: IPolicy[];
  private permissions: IPolicyStatement[];

  genericDenyMessage: string = $localize `:@@permissions.need-permissions-to-operate:You don't have permissions to take this action, please contact the admin to grant you the necessary permissions`;

  constructor(private memberSvc: MemberService) {
  }

  async fetchPolicies(memberId: string) {
    const policies = await lastValueFrom<IPolicy[]>(this.memberSvc.getAllPolicies(memberId));
    this.policies = [...policies];
    this.permissions = policies.flatMap(p => p.statements);
  }

  // use "*" (star) as a wildcard for example:
  // "a*b" => everything that starts with "a" and ends with "b"
  // "a*" => everything that starts with "a"
  // "*b" => everything that ends with "b"
  // "*a*" => everything that has an "a" in it
  // "*a*b*"=> everything that has an "a" in it, followed by anything, followed by a "b", followed by anything
  private matchRule(str, rule) {
    var escapeRegex = (s) => s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
    return new RegExp("^" + rule.split("*").map(escapeRegex).join(".*") + "$").test(str);
  }

  // //Explanation code
  // function matchRuleExpl(str, rule) {
  //   // for this solution to work on any string, no matter what characters it has
  //   var escapeRegex = (str) => str.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");
  //
  //   // "."  => Find a single character, except newline or line terminator
  //   // ".*" => Matches any string that contains zero or more characters
  //   rule = rule.split("*").map(escapeRegex).join(".*");
  //
  //   // "^"  => Matches any string with the following at the beginning of it
  //   // "$"  => Matches any string with that in front at the end of it
  //   rule = "^" + rule + "$"
  //
  //   //Create a regular expression object for matching string
  //   var regex = new RegExp(rule);
  //
  //   //Returns true if it finds a match, otherwise it returns false
  //   return regex.test(str);
  // }

  getResourceRN(resourceType: string, resource: any) {
    switch (resourceType) {
      case ResourceTypeEnum.Project:
        return `project/${resource.name}`;
      default:
        return `resource type ${resourceType} not supported`;
    }
  }

  // if return undefined, that means zero permission is defined on that resource
  canTakeAction(rn: string, action: string): boolean | undefined | any {
    const [resourceType, _] = rn.split('/');

    const statements = this.permissions.filter(s => {
        if (s.resourceType === ResourceTypeEnum.All) {
          return s.effect === EffectEnum.Allow;
        }

        if (s.resourceType === ResourceTypeEnum.General) {
          return s.resources.map(r => r.split('/')[0]).includes(resourceType) && s.actions.includes(action);
        }

        const matchingResource = s.resources.find(rsc => {
          // check exact match
          if (this.matchRule(rn, rsc)){
            return true;
          }

          // check ancestors matches following bottom up order
          const rnParts = rn.split(':');
          return [...rnParts].reverse().some((part, idx) => {
            rnParts.pop();
            return this.matchRule(rnParts.join(':'), rsc);
          });
        });

        return matchingResource !== undefined && s.actions.includes(action)
    });

    if (statements.find(s => s.effect === EffectEnum.Deny) !== undefined) {
      return false;
    }

    return statements.find(s => s.effect !== EffectEnum.Deny && (s.actions.find(act => act === '*') || s.actions.includes(action)));
  }
}
