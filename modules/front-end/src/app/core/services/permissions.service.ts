import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { IPolicy } from "@features/safe/iam/types/policy";
import { MemberService } from "@services/member.service";
import { EffectEnum, IamPolicyAction, IPolicyStatement, ResourceTypeEnum } from "@shared/policy";
import { IEnvironment, IProject } from "@shared/types";

@Injectable({
  providedIn: 'root'
})
export class PermissionsService {
  userPolicies: IPolicy[];
  userPermissions: IPolicyStatement[];

  genericDenyMessage: string = $localize`:@@permissions.need-permissions-to-operate:You don't have permissions to take this action, please contact the admin to grant you the necessary permissions`;

  constructor(private memberSvc: MemberService) {
  }

  async initUserPolicies(memberId: string) {
    const policies = await firstValueFrom<IPolicy[]>(this.memberSvc.getAllPolicies(memberId));
    this.userPolicies = [...policies];
    this.userPermissions = policies.flatMap(p => p.statements);
  }

  // Prefix-based segment matching:
  // The rule segments are matched from left to right.
  // A match succeeds if all rule segments match the corresponding
  // prefix segments of the target string.
  // use "*" (star) as a wildcard for example:
  // "a*b" => everything that starts with "a" and ends with "b"
  // "a*" => everything that starts with "a"
  // "*b" => everything that ends with "b"
  // "*a*" => everything that has an "a" in it
  // "*a*b*"=> everything that has an "a" in it, followed by anything, followed by a "b", followed by anything
  private matchRule(str: string, rule: string): boolean {
    var escapeRegex = (s) => s.replace(/([.*+?^=!:${}()|\[\]\/\\])/g, "\\$1");

    const wildcardToRegex = (pattern: string) =>
      new RegExp(
        "^" +
        pattern
        .split("*")
        .map(escapeRegex)
        .join(".*") +
        "$"
      );

    const parseSegments = (input: string) =>
      input.split(":").map(segment => {
        const [path, tagsPart = ""] = segment.split(";");
        const tags = tagsPart ? tagsPart.split(",") : [];
        return { path, tags };
      });

    const strSegments = parseSegments(str);
    const ruleSegments = parseSegments(rule);

    if (ruleSegments.length > strSegments.length) {
      return false;
    }

    for (let i = 0; i < ruleSegments.length; i++) {
      const { path: rulePath, tags: ruleTags } = ruleSegments[i];
      const { path: strPath, tags: strTags } = strSegments[i];

      // —— path match（support *）——
      const pathRegex = wildcardToRegex(rulePath);
      if (!pathRegex.test(strPath)) {
        return false;
      }

      // —— tag match（support *，OR）——
      if (ruleTags.length > 0) {
        let hit = false;

        for (const ruleTag of ruleTags) {
          const tagRegex = wildcardToRegex(ruleTag);

          if (strTags.some(strTag => tagRegex.test(strTag))) {
            hit = true;
            break;
          }
        }

        if (!hit) {
          return false;
        }
      }
    }

    return true;
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

  getProjectRN = (project: IProject) => `${ResourceTypeEnum.Project}/${project.key}`;

  getEnvRN = (project: IProject, env: IEnvironment) => `${ResourceTypeEnum.Project}/${project.key}:${ResourceTypeEnum.Env}/${env.key}`;

  private getMatchedPermissions(rn: string, action: IamPolicyAction): IPolicyStatement[] {
    return this.userPermissions.filter(permission => {
      if (permission.resourceType === ResourceTypeEnum.All) {
        return true;
      }

      return permission.resources.some(rsc => this.matchRule(rn, rsc)) &&
        permission.actions.some(act => act === '*' || act === action.name);
    });
  }

  isGranted(rn: string, action: IamPolicyAction): boolean {
    const matchedPermissions = this.getMatchedPermissions(rn, action);

    if (matchedPermissions.length === 0) {
      return false;
    }

    return matchedPermissions.every(s => s.effect === EffectEnum.Allow);
  }
}
