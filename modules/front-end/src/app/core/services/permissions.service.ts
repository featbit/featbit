import { Injectable } from "@angular/core";
import { lastValueFrom } from "rxjs";
import { IPolicy } from "@features/safe/iam/types/policy";
import { MemberService } from "@services/member.service";
import { EffectEnum, IamPolicyAction, IPolicyStatement, ResourceTypeEnum } from "@shared/policy";

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  userPolicies: IPolicy[];
  userPermissions: IPolicyStatement[];

  genericDenyMessage: string = $localize`:@@permissions.need-permissions-to-operate:You don't have permissions to take this action, please contact the admin to grant you the necessary permissions`;

  constructor(private memberSvc: MemberService) {
  }

  async fetchPolicies(memberId: string) {
    const policies = await lastValueFrom<IPolicy[]>(this.memberSvc.getAllPolicies(memberId));
    this.userPolicies = [...policies];
    this.userPermissions = policies.flatMap(p => p.statements);
  }

  // use "*" (star) as a wildcard for example:
  // "a*b" => everything that starts with "a" and ends with "b"
  // "a*" => everything that starts with "a"
  // "*b" => everything that ends with "b"
  // "*a*" => everything that has an "a" in it
  // "*a*b*"=> everything that has an "a" in it, followed by anything, followed by a "b", followed by anything
  private matchRule(str: string, rule: string): boolean {
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
  isGranted(rn: string, action: IamPolicyAction): boolean | undefined | any {
    const matchedPermissions = this.userPermissions.filter(permission => {
      if (permission.resourceType === ResourceTypeEnum.All) {
        return true;
      }

      return permission.resources.some(rsc => this.matchRule(rn, rsc)) &&
        permission.actions.some(act => act === '*' || act === action.name);
    });

    if (matchedPermissions.length === 0) {
      return false;
    }

    return matchedPermissions.every(s => s.effect === EffectEnum.Allow);
  }
}
