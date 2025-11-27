import { Component, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ISegment, ISegmentFlagReference, SegmentType } from '@features/safe/segments/types/segments-index';
import { SegmentService } from '@services/segment.service';
import { NzMessageService } from 'ng-zorro-antd/message';
import { MessageQueueService } from "@services/message-queue.service";
import { NzSelectComponent } from "ng-zorro-antd/select";

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
    private segmentService: SegmentService,
    private messageQueueService: MessageQueueService,
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
      this.messageQueueService.subscribe(this.messageQueueService.topics.SEGMENT_TARGETING_CHANGED(this.id), () => this.loadData());
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

  save() {
    this.segmentService.update(this.segmentDetail).subscribe((result) => {
      this.segmentDetail = {...result};
      this.msg.success($localize `:@@common.operation-success:Operation succeeded`);
      this.messageQueueService.emit(this.messageQueueService.topics.SEGMENT_SETTING_CHANGED(this.id));
    }, errResponse => this.msg.error(errResponse.error));
  }

  saveTitle() {
    this.toggleTitleEditState();
    this.save();
  }

  saveDescription() {
    this.toggleDescriptionEditState();
    this.save();
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
    let actualTag = this.selectedTag.startsWith(this.createTagPrefix)
      ? this.selectedTag.replace(this.createTagPrefix, '').replace(/'/g, '').trim()
      : this.selectedTag.trim();

    this.segmentDetail.tags = [...this.segmentDetail.tags, actualTag];
    this.segmentService.setTags(this.segmentDetail.id, this.segmentDetail.tags).subscribe(_ => {
      this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
    });

    this.allTags = [...this.allTags, actualTag];
    this.currentAllTags = this.allTags;
    // clear current selected
    this.tagsSelect.writeValue(null);
  }

  protected readonly SegmentType = SegmentType;
}
