import { Component } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { EnvUserService } from '@services/env-user.service';
import { SegmentService } from '@services/segment.service';
import { IUserProp, IUserType } from '@shared/types';

import { ISegment, ISegmentFlagReference, Segment } from '../../types/segments-index';
import { IFftuwmtrParams, IJsonContent } from "@features/safe/feature-flags/types/switch-new";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { EnvUserPropService } from "@services/env-user-prop.service";
import { EnvUserFilter } from "@features/safe/users/types/featureflag-user";

@Component({
  selector: 'segment-targeting',
  templateUrl: './targeting.component.html',
  styleUrls: ['./targeting.component.less']
})
export class TargetingComponent {
  public segmentDetail: Segment;
  public userList: IUserType[] = [];
  public isLoading: boolean = true;
  public isUserPropsLoading: boolean = true;
  public id: string;
  public targetIndividualsActive = true;

  public flagReferences: ISegmentFlagReference[] = [];
  constructor(
    private router: Router,
    private route:ActivatedRoute,
    private segmentService: SegmentService,
    private envUserService: EnvUserService,
    private envUserPropService: EnvUserPropService,
    private msg: NzMessageService
  ) {
    this.route.paramMap.subscribe( paramMap => {
      this.id = decodeURIComponent(paramMap.get('id'));
      return this.segmentService.getSegment(this.id).subscribe((result: ISegment) => {
        if (result) {
          this.id = result.id;
          this.loadSegment(result);
          this.segmentService.getFeatureFlagReferences(this.id).subscribe((flags: ISegmentFlagReference[]) => {
            this.flagReferences = [...flags];
          });
        }
      })
    })

    // user properties
    this.envUserPropService.getProp().subscribe(properties => {
      this.userProps = properties;
      this.isUserPropsLoading = false;
    }, () => this.isUserPropsLoading = false);
  }

  public openFlagPage(flagKeyName: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/feature-flags/${flagKeyName}/targeting`])
    );

    window.open(url, '_blank');
  }

  private loadSegment(segment: ISegment) {
    this.segmentDetail = new Segment(segment);
    this.segmentService.setCurrent(this.segmentDetail.segment);
    // load users
    const userKeyIds = [...segment.included, ...segment.excluded];
    if (userKeyIds.length > 0) {
      this.envUserService.getUsersByKeyIds(userKeyIds).subscribe((users: IUserType[]) => {
        this.segmentDetail.includedUsers = this.segmentDetail.segment.included.map(keyId => users.find(u => u.keyId === keyId));
        this.segmentDetail.excludedUsers = this.segmentDetail.segment.excluded.map(keyId => users.find(u => u.keyId === keyId));
        this.isLoading = false;
      });
    } else {
      this.isLoading = false;
    }
  }

  public onSearchUser(searchText: string = '') {
    const filter = new EnvUserFilter(searchText, ['Name', 'KeyId'], 1, 5);
    this.envUserService.search(filter).subscribe(pagedResult => {
      this.userList = [...pagedResult.items];
    })
  }

  public onSelectedUserListChange(data: IUserType[], isIncluded: boolean) {
    if (isIncluded) {
      this.segmentDetail.includedUsers = data;
    } else {
      this.segmentDetail.excludedUsers = data;
    }
  }

  public onSave() {
    this.isLoading = true;
    this.segmentService.update(this.segmentDetail.dataToSave)
      .subscribe((result) => {
        this.msg.success($localize `:@@common.operation-success:Operation succeeded`);
        this.loadSegment(result);
        this.isLoading = false;
    }, _ => {
      this.msg.error("修改失败!");
      this.isLoading = false;
    })
  }

  userProps: IUserProp[] = [];

  trackRuleById(_, rule: IFftuwmtrParams) {
    return rule.ruleId;
  }

  addRule() {
    this.segmentDetail.newRule();
  }

  deleteRule(index: number) {
    this.segmentDetail.removeRule(index);
  }

  onRuleConfigChange(config: IJsonContent[], index: number) {
    this.segmentDetail.updateRuleItem(config, index);
  }

  onDrop(event: CdkDragDrop<string[]>) {
    moveItemInArray(this.segmentDetail.rules, event.previousIndex, event.currentIndex);
  }
}
