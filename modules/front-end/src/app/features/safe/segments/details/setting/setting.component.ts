import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ISegment, ISegmentFlagReference, SegmentType } from '@features/safe/segments/types/segments-index';
import { SegmentService } from '@services/segment.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectComponent } from "ng-zorro-antd/select";
import { copyToClipboard } from "@utils/index";

@Component({
    selector: 'segment-setting',
    templateUrl: './setting.component.html',
    styleUrls: ['./setting.component.less'],
    standalone: false
})
export class SettingComponent implements OnInit {
  id: string;
  segmentDetail: ISegment = null;
  isLoading: boolean = true;
  flagReferences: ISegmentFlagReference[] = [];

  isEditingTitle = false;
  isEditingDescription = false;

  constructor(
    private route:ActivatedRoute,
    private msg: NzMessageService,
    private segmentService: SegmentService
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
    return this.segmentService.getSegment(this.id).subscribe((result: ISegment) => {
      if (result) {
        this.id = result.id;
        this.loadSegment(result);
      }
    })
  }

  private loadSegment(segment: ISegment) {
    this.segmentDetail = {...segment, tags: segment.tags || []};
    this.isLoading = false;
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
    this.segmentDetail.tags = this.segmentDetail.tags.filter(t => t !== tag);
    this.segmentService.setTags(this.segmentDetail.id, this.segmentDetail.tags).subscribe(_ => {
      this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
    });
  }

  onAddTag() {
    const isNewTag = this.selectedTag.startsWith(this.createTagPrefix);

    const actualTag = isNewTag
      ? this.selectedTag.replace(this.createTagPrefix, '').replace(/'/g, '').trim()
      : this.selectedTag.trim();

    this.segmentDetail.tags = [...this.segmentDetail.tags, actualTag];
    this.segmentService.setTags(this.segmentDetail.id, this.segmentDetail.tags).subscribe(_ => {
      this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
    });

    if (isNewTag) {
      this.allTags = [...this.allTags, actualTag];
      this.currentAllTags = this.allTags;
    }

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
