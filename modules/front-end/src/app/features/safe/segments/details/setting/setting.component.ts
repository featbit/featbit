import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ISegment, ISegmentFlagReference, Segment, SegmentType } from '@features/safe/segments/types/segments';
import { SegmentService } from '@services/segment.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectComponent } from "ng-zorro-antd/select";
import { copyToClipboard } from "@utils/index";
import { permissionActions } from "@shared/policy";
import { PermissionsService } from "@services/permissions.service";
import { PermissionLicenseService } from "@services/permission-license.service";
import { finalize } from "rxjs/operators";
import { ChangeCommentService } from "@services/change-comment.service";
import { ChangeOperation } from "@core/components/change-comment/types";
import { Observable } from "rxjs";

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
    private changeCommentService: ChangeCommentService
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
        this.pendingTags = [...this.segmentDetail.tags];
      },
      error: () => this.msg.error($localize`:@@common.failed-to-load-data:Failed to load data`)
    });
  }

  saveTitle() {
    const { id, name } = this.segmentDetail;
    this.promptChangeComment(ChangeOperation.ChangeName).subscribe(comment => {
      if (comment === null) return;
      this.segmentService.updateName(id, name, comment).subscribe({
        next: () => {
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
          this.isEditingTitle = false;
        },
        error: () => this.msg.error($localize `:@@common.operation-failed:Operation failed`)
      });
    });
  }

  saveDescription() {
    const { id, description } = this.segmentDetail;
    this.promptChangeComment(ChangeOperation.ChangeDescription).subscribe(comment => {
      if (comment === null) return;
      this.segmentService.updateDescription(id, description, comment).subscribe({
        next: () => {
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
          this.isEditingDescription = false;
        },
        error: () => this.msg.error($localize `:@@common.operation-failed:Operation failed`)
      });
    });
  }

  toggleTitleEditState(): void {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.segmentDetail.rn, permissionActions.UpdateSegmentName);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (this.isEditingTitle) {
      // Cancel editing, reset name to original value
      this.segmentDetail.name = this.segmentDetail.originalData.name;
    }

    this.isEditingTitle = !this.isEditingTitle;
  }

  toggleDescriptionEditState(): void {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.segmentDetail.rn, permissionActions.UpdateSegmentDescription);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (this.isEditingDescription) {
      // Cancel editing, reset description to original value
      this.segmentDetail.description = this.segmentDetail.originalData.description;
    }

    this.isEditingDescription = !this.isEditingDescription;
  }

  allTags: string[] = [];
  currentAllTags: string[] = [];
  selectedTag: string = '';
  isLoadingTags: boolean = true;
  pendingTags: string[] = [];

  get hasPendingTagChanges(): boolean {
    const saved = this.segmentDetail.tags ?? [];
    if (this.pendingTags.length !== saved.length) return true;
    const sorted1 = [...this.pendingTags].sort();
    const sorted2 = [...saved].sort();
    return sorted1.some((t, i) => t !== sorted2[i]);
  }

  @ViewChild('tags') tagsSelect: NzSelectComponent;
  createTagPrefix = $localize`:@@common.create-tag:Create Tag`;

  isTagSelected(tag: string): boolean {
    return this.pendingTags.includes(tag);
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

  onRemoveTag(event: MouseEvent, tag: string) {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.segmentDetail.rn, permissionActions.UpdateSegmentTags);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.pendingTags = this.pendingTags.filter(t => t !== tag);
  }

  onAddTag() {
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(this.segmentDetail.rn, permissionActions.UpdateSegmentTags);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    if (!this.selectedTag) return;

    const isNewTag = this.selectedTag.startsWith(this.createTagPrefix);
    const actualTag = isNewTag
      ? this.selectedTag.replace(this.createTagPrefix, '').replace(/'/g, '').trim()
      : this.selectedTag.trim();

    if (!this.pendingTags.includes(actualTag)) {
      this.pendingTags = [...this.pendingTags, actualTag];
    }

    if (isNewTag) {
      this.allTags = [...this.allTags, actualTag];
    }

    this.currentAllTags = this.allTags;
    this.tagsSelect.writeValue(null);
  }

  onSaveTags() {
    this.promptChangeComment(ChangeOperation.UpdateTags).subscribe(comment => {
      if (comment === null) return;
      this.segmentService.setTags(this.segmentDetail.id, this.pendingTags, comment).subscribe({
        next: () => {
          this.segmentDetail.tags = [...this.pendingTags];
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => this.msg.error($localize `:@@common.operation-failed:Operation failed`)
      });
    });
  }

  onCancelSaveTags() {
    this.pendingTags = [...(this.segmentDetail.tags ?? [])];
    this.currentAllTags = this.allTags;
    this.tagsSelect.writeValue(null);
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.msg.success($localize `:@@common.copy-success:Copied`)
    );
  }

  private promptChangeComment(operation: ChangeOperation): Observable<string | null> {
    return this.changeCommentService.promptSegment(this.segmentDetail.key, operation);
  }

  protected readonly SegmentType = SegmentType;
}
