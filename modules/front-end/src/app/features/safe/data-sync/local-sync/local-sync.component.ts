import { Component, ElementRef, ViewChild } from '@angular/core';
import { DomSanitizer, SafeUrl } from "@angular/platform-browser";
import { DataSyncService } from "@services/data-sync.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { IProjectEnv } from "@shared/types";
import { getCurrentProjectEnv } from "@utils/project-env";

@Component({
  selector: 'local-sync',
  templateUrl: './local-sync.component.html',
  styleUrls: ['./local-sync.component.less']
})
export class LocalSyncComponent {

  isDownloading: boolean = false;
  uploadFormVisible: boolean = false;
  downloadFileName: string = null;

  @ViewChild('downloadRef', { static: false })
  downloadRef: ElementRef;

  get projectEnv(): IProjectEnv {
    return getCurrentProjectEnv();
  }

  constructor(
    private dataSyncService: DataSyncService,
    private message: NzMessageService,
    private sanitizer: DomSanitizer
  ) {
  }

  openUploadForm() {
    this.uploadFormVisible = true;
  }

  onDownload() {
    this.isDownloading = true;
    this.dataSyncService.download().subscribe(data => this.downloadFile(data), _ => {
      this.isDownloading = false;
      this.message.error("数据下载失败！");
    });
  }

  downloadUri: SafeUrl = null;

  downloadFile(data) {
    this.downloadFileName = 'feature_flags_' + data.date + ".json";
    var theJSON = JSON.stringify(data);
    this.downloadUri = this.sanitizer.bypassSecurityTrustUrl("data:application/json;charset=UTF-8," + encodeURIComponent(theJSON));

    window.setTimeout(() => {
      this.isDownloading = false;
      this.downloadRef.nativeElement.click();
      this.downloadUri = null;
    }, 0);
  }

  onUploadClosed() {
    this.uploadFormVisible = false;
  }
}
