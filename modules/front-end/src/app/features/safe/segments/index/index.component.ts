import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { copyToClipboard, encodeURIComponentFfc } from '@shared/utils';
import {
  SegmentListFilter,
  ISegment,
  ISegmentListModel,
  ISegmentFlagReference,
  SegmentType,
  getSegmentRN
} from "../types/segments";
import { SegmentService } from "@services/segment.service";
import { debounceTime } from 'rxjs/operators';
import { getCurrentEnvRN, getCurrentProjectEnv } from "@utils/project-env";
import { EnvironmentSetting } from "@shared/types";
import { permissionActions } from "@shared/policy";
import { PermissionLicenseService } from "@services/permission-license.service";
import { PermissionsService } from "@services/permissions.service";
import { NzModalService } from "ng-zorro-antd/modal";
import { ChangeCommentService } from "@services/change-comment.service";
import { ChangeOperation } from "@core/components/change-comment/types";

@Component({
    selector: 'segments-index',
    templateUrl: './index.component.html',
    styleUrls: ['./index.component.less'],
    standalone: false
})
export class IndexComponent implements OnInit {
  constructor(
    private router: Router,
    private segmentService: SegmentService,
    private msg: NzMessageService,
    private permissionsService: PermissionsService,
    private permissionLicenseService: PermissionLicenseService,
    private changeCommentService: ChangeCommentService,
    private modal: NzModalService
  ) { }

  envSettings: EnvironmentSetting;

  ngOnInit(): void {
    this.envSettings = getCurrentProjectEnv()!.envSettings;
    this.subscribeSearch();
    this.$search.next();
  }

  flagReferences: ISegmentFlagReference[] = [];
  flagReferencesModalVisible: boolean = false;
  loadingFlagReferenceFor: string = '';
  archive(segment: ISegment) {
    const rn = getSegmentRN(segment.key, segment.tags || []);

    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.ArchiveSegment);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    const doArchive = (comment: string = '') => {
      this.segmentService.archive(segment.id, comment || undefined).subscribe({
        next: () => {
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
          this.onSearch();
        },
        error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
      });
    }

    this.loadingFlagReferenceFor = segment.id;
    this.segmentService.getFeatureFlagReferences(segment.id).subscribe({
      next: (references: ISegmentFlagReference[]) => {
        this.flagReferences = references;

        if (references.length > 0) {
          this.flagReferencesModalVisible = true;
        } else {
          if (this.envSettings.requireChangeComment) {
            this.changeCommentService.promptSegment(segment.key, ChangeOperation.ArchiveSegment).subscribe(comment => {
              if (comment === null) return;
              doArchive(comment);
            });
          } else {
            this.modal.confirm({
              nzTitle: $localize`:@@segments.archive-confirm-message:Are you sure to archive segment`,
              nzContent: $localize`:@@segments.archive-confirm-subtitle:This segment is not referenced by any feature flag, you can safely archive it.`,
              nzOnOk: doArchive,
              nzCentered: true,
              nzClassName: 'warning-modal-dialog',
              nzOkText: $localize`:@@common.archive:Archive`,
              nzWidth: '550px'
            });
          }
        }

        this.loadingFlagReferenceFor = '';
      },
      error: () => {
        this.msg.error($localize`:@@segments.load-flag-references-failed:Failed to load flag references, please try again`);
        this.loadingFlagReferenceFor = '';
      }
    });
  }

  restore(segment: ISegment) {
    const rn = getSegmentRN(segment.key, segment.tags);
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.RestoreSegment);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.changeCommentService.promptSegment(segment.key, ChangeOperation.Restore).subscribe(comment => {
      if (comment === null) return;
      this.segmentService.restore(segment.id, comment).subscribe({
        next: () => {
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
          this.onSearch();
        },
        error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
      });
    });
  }

  delete(segment: ISegment) {
    const rn = getSegmentRN(segment.key, segment.tags || []);

    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.DeleteSegment);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.changeCommentService.promptSegment(segment.key, ChangeOperation.Delete).subscribe(comment => {
      if (comment === null) return;
      this.segmentService.delete(segment.id, comment).subscribe({
        next: () => {
          this.onSearch();
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
      });
    });
  }

  segmentListModel: ISegmentListModel = {
    items: [],
    totalCount: 0
  };

  loading: boolean = true;

  loadSegmentList() {
    this.loading = true;
    this.segmentService
      .getSegmentList(this.segmentFilter)
      .subscribe((segments: ISegmentListModel) => {
        this.segmentListModel = segments;
        this.loading = false;
      });
  }

  segmentFilter: SegmentListFilter = new SegmentListFilter();

  toggleArchiveFilter() {
    this.segmentFilter.isArchived = !this.segmentFilter.isArchived;
    this.onSearch(true);
  }

  $search: Subject<void> = new Subject();

  onSearch(resetPage?: boolean) {
    this.loading = true;
    this.segmentListModel = {
      items: [],
      totalCount: 0
    };

    if (resetPage) {
      this.segmentFilter.pageIndex = 1;
    }
    this.$search.next();
  }

  subscribeSearch() {
    this.$search.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.loadSegmentList();
    });
  }

  private toRouter(id: string) {
    this.router.navigateByUrl(`/segments/${encodeURIComponentFfc(id)}/targeting`).then();
  }

  creationModalVisible: boolean = false;
  showCreationModal() {
    const rnPrefix = getCurrentEnvRN();
    const isGranted = !!rnPrefix && this.permissionLicenseService.isGrantedByLicenseAndPermission(`${rnPrefix}:segment/*`, permissionActions.CreateSegment);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }
    this.creationModalVisible = true;
  }

  closeCreationModal(segment: ISegment) {
    this.creationModalVisible = false;
    if (segment) {
      setTimeout(() => {
        this.toRouter(segment.id);
      }, 50);
    }
  }

  copyText(event: any, text: string) {
    copyToClipboard(text).then(
      () => this.msg.success($localize `:@@common.copy-success:Copied`)
    );
  }
  protected readonly SegmentType = SegmentType;
}
