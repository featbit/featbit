import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { copyToClipboard, encodeURIComponentFfc, getPathPrefix } from '@shared/utils';
import {
  SegmentListFilter,
  ISegment,
  ISegmentListModel,
  ISegmentFlagReference,
  SegmentType
} from "../types/segments";
import { SegmentService } from "@services/segment.service";
import { debounceTime } from 'rxjs/operators';
import { getCurrentEnvRN } from "@utils/project-env";
import { permissionActions } from "@shared/policy";
import { PermissionLicenseService } from "@services/permission-license.service";
import { PermissionsService } from "@services/permissions.service";
import { getFlagRN } from "@features/safe/feature-flags/types/feature-flag";

@Component({
    selector: 'segments-index',
    templateUrl: './index.component.html',
    styleUrls: ['./index.component.less'],
    standalone: false
})
export class IndexComponent implements OnInit {

  isDelete: boolean = false; // to differencing delete and archive
  deleteArchiveModalVisible: boolean = false;

  currentDeletingArchivingSegment: ISegment;
  currentDeletingArchivingSegmentFlagReferences: ISegmentFlagReference[] = [];

  constructor(
    private router: Router,
    private segmentService: SegmentService,
    private msg: NzMessageService,
    private permissionsService: PermissionsService,
    private permissionLicenseService: PermissionLicenseService,
  ) { }

  deleteArchiveValidation(segment: ISegment, isDelete: boolean) {
    this.isDelete = isDelete;
    this.currentDeletingArchivingSegment = segment;
    this.currentDeletingArchivingSegmentFlagReferences = [];
    this.segmentService.getFeatureFlagReferences(segment.id).subscribe((flags: ISegmentFlagReference[]) => {
      this.currentDeletingArchivingSegmentFlagReferences = [...flags];
      this.deleteArchiveModalVisible = true;
    });
  }

  restore(segment: ISegment) {
    const rn = getFlagRN(segment.key, segment.tags);
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.RestoreSegment);
    if (!isGranted) {
      this.msg.warning(this.permissionsService.genericDenyMessage);
      return;
    }

    this.segmentService.restore(segment.id).subscribe({
      next: () => {
        this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        this.onSearch();
      },
      error: () => this.msg.error($localize`:@@common.operation-failed:Operation failed`)
    });
  }

  closeDeleteArchiveModal() {
    this.deleteArchiveModalVisible = false;
  }

  deletingOrArchiving: boolean = false;
  deleteArchive(segment: ISegment) {
    this.deletingOrArchiving = true;
    const rn = getFlagRN(segment.key, segment.tags);

    if (this.isDelete) {
      const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.DeleteSegment);
      if (!isGranted) {
        this.msg.warning(this.permissionsService.genericDenyMessage);
        return;
      }

      this.segmentService.delete(segment.id).subscribe({
        next: () => {
          this.segmentListModel.items = this.segmentListModel.items.filter(it => it.id !== segment.id);
          this.segmentListModel.totalCount--;
          this.deletingOrArchiving = false;
          this.closeDeleteArchiveModal();
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => {
          this.deletingOrArchiving = false;
          this.closeDeleteArchiveModal();
        }
      });
    } else { // archiving
      const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(rn, permissionActions.ArchiveSegment);
      if (!isGranted) {
        this.msg.warning(this.permissionsService.genericDenyMessage);
        return;
      }

      this.segmentService.archive(segment.id).subscribe({
        next: () => {
          this.deletingOrArchiving = false;
          this.onSearch();
          this.closeDeleteArchiveModal();
          this.msg.success($localize`:@@common.operation-success:Operation succeeded`);
        },
        error: () => {
          this.msg.error($localize`:@@common.operation-failed-try-again:Operation failed, please try again`);
          this.deletingOrArchiving = false;
          this.closeDeleteArchiveModal();
        }
      });
    }
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

  //#endregion
  ngOnInit(): void {
    this.subscribeSearch();
    this.$search.next();
  }

  private toRouter(id: string) {
    this.router.navigateByUrl(`/segments/${encodeURIComponentFfc(id)}/targeting`);
  }

  openFlagPage(flagKey: string) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`/${getPathPrefix()}feature-flags/${flagKey}/targeting`])
    );

    window.open(url, '_blank');
  }

  creationModalVisible: boolean = false;
  showCreationModal() {
    const rnPrefix = getCurrentEnvRN();
    const isGranted = this.permissionLicenseService.isGrantedByLicenseAndPermission(`${rnPrefix}:segment/*`, permissionActions.CreateSegment);
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
