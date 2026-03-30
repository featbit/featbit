import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  getSegmentRN,
  ISegment,
  ISegmentFlagReference,
  Segment,
  SegmentType
} from '@features/safe/segments/types/segments';
import { SegmentService } from '@services/segment.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectComponent } from "ng-zorro-antd/select";
import { copyToClipboard } from "@utils/index";
import { permissionActions } from "@shared/policy";
import { PermissionsService } from "@services/permissions.service";
import { PermissionLicenseService } from "@services/permission-license.service";
import { finalize } from "rxjs/operators";

@Component({
    selector: 'segment-setting',
    templateUrl: './setting.component.html',
    styleUrls: ['./setting.component.less'],
    standalone: false
})
export class SettingComponent implements OnInit {
  id: string;
  segmentDetail: Segment = {} as Segment;
  isLoading: boolean = true;
  flagReferences: ISegmentFlagReference[] = [];

  isEditingTitle = false;
  isEditingDescription = false;

  constructor(
    private route:ActivatedRoute,
    private msg: NzMessageService,
    private segmentService: SegmentService,
    private permissionsService: PermissionsService,
    private permissionLicenseService: PermissionLicenseService,
  ) {
    this.segmentService.getAllTags().subscribe(allTags => {
      this.allTags = allTags;
      this.currentAllTags = allTags;
      this.isLoadingTags = false;
    });
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
      this.id = decodeURIComponent(paramMap.get('id'));
      this.loadData();
      this.segmentService.getFeatureFlagReferences(this.id).subscribe((flags: ISegmentFlagReference[]) => {
        this.flagReferences = [...flags];
      });
    })
  }

  private async loadData() {
    this.isLoading = true;
    this.segmentService.getSegment(this.id)
    .pipe(finalize(() => this.isLoading = false))
    .subscribe({
      next: (result: ISegment) => {
        this.segmentDetail = new Segment(result);
      },
      error: () => this.msg.error($localize`:@@common.failed-to-load-data:Failed to load data`)
    });
  }

  saveTitle() {
    this.toggleTitleEditState();

    const { id, name } = this.segmentDetail;
    this.segmentService.updateName(id, name).subscribe({
      next: () => this.msg.success($localize `:@@common.operation-success:Operation succeeded`),
      error: () => this.msg.error($localize `:@@common.operation-failed:Operation failed`)
    });
  }

  saveDescription() {
    this.toggleDescriptionEditState();

    const { id, description } = this.segmentDetail;
    this.segmentService.updateDescription(id, description).subscribe({
      next: () => this.msg.success($localize `:@@common.operation-success:Operation succeeded`),
      error: () => this.msg.error($localize `:@@common.operation-failed:Operation failed`)
    });
  }

  toggleTitleEditState(): void {
    this.isEditingTitle = !this.isEditingTitle;
  }

  toggleDescriptionEditState(): void {
    this.isEditingDescription = !this.isEditingDescription;
  }

  allTags: string[] = [];
  currentAllTags: string[] = [];
  selectedTag: string = '';
  isLoadingTags: boolean = true;

  @ViewChild('tags') tagsSelect: NzSelectComponent;
  createTagPrefix = $localize`:@@common.create-tag:Create Tag`;

  isTagSelected(tag: string): boolean {
    return this.segmentDetail.tags.includes(tag);
  }

  onSearchTag(value: string) {
    this.currentAllTags = [...this.allTags];

    if (!value) {
      return;
    }

    if (this.currentAllTags.findIndex(x => x.startsWith(value)) === -1) {
      this.currentAllTags = [`${this.createTagPrefix} '${value}'`];
    }
  }

  onRemoveTag(tag: string) {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.segmentDetail.rn, permissionActions.UpdateSegmentTags);
    if (!isGranted) {
      this.segmentDetail.tags = [...this.segmentDetail.tags, tag]; // restore the removed tag
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.segmentDetail.removeTag(tag);
    this.segmentService.setTags(this.segmentDetail.id, this.segmentDetail.tags).subscribe(_ => {
      this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
    });
  }

  onAddTag() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.segmentDetail.rn, permissionActions.UpdateSegmentTags);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const isNewTag = this.selectedTag.startsWith(this.createTagPrefix);

    const actualTag = isNewTag
      ? this.selectedTag.replace(this.createTagPrefix, '').replace(/'/g, '').trim()
      : this.selectedTag.trim();

    this.segmentDetail.addTag(actualTag);
    this.segmentService.setTags(this.segmentDetail.id, this.segmentDetail.tags).subscribe(_ => {
      this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
    });

    if (isNewTag) {
      this.allTags = [...this.allTags, actualTag];
    }

    this.currentAllTags = this.allTags;
    // clear current selected
    this.tagsSelect.writeValue(null);
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.msg.success($localize `:@@common.copy-success:Copied`)
    );
  }

  protected readonly SegmentType = SegmentType;
}
