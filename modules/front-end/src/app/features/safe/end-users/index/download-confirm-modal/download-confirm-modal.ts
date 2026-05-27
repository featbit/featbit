import { Component, EventEmitter, inject, Input, Output } from "@angular/core";
import { Subscription } from "rxjs";
import { NzAlertComponent } from "ng-zorro-antd/alert";
import { NzButtonComponent } from "ng-zorro-antd/button";
import { NzModalComponent, NzModalContentDirective, NzModalFooterDirective } from "ng-zorro-antd/modal";
import { EnvUserService } from "@services/env-user.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { EnvUserFilter } from "@features/safe/end-users/types/featureflag-user";

@Component({
  selector: 'download-confirm-modal',
  templateUrl: './download-confirm-modal.html',
  styleUrl: './download-confirm-modal.less',
  imports: [
    NzAlertComponent,
    NzButtonComponent,
    NzModalComponent,
    NzModalFooterDirective,
    NzModalContentDirective
  ],
})
export class DownloadConfirmModal {
  endUserService = inject(EnvUserService);
  messageService = inject(NzMessageService);

  @Input()
  visible: boolean = false;

  @Input()
  totalCount: number = 0;

  @Input()
  filter: EnvUserFilter = new EnvUserFilter();

  @Output()
  close: EventEmitter<boolean> = new EventEmitter<boolean>();

  isDownloading: boolean = false;
  private downloadSub?: Subscription;

  confirmDownload() {
    this.isDownloading = true;
    this.downloadSub = this.endUserService.download(this.filter).subscribe({
      next: (data) => {
        this.isDownloading = false;
        const json = JSON.stringify(data);
        const blob = new Blob([ json ], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `end-users-${this.totalCount}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => {
          URL.revokeObjectURL(url);
          this.close.emit(true);
        }, 100);
      },
      error: () => {
        this.isDownloading = false;
        this.messageService.error($localize`:@@common.operation-failed:Operation failed`);
      }
    });
  }

  onClose(confirmed: boolean = false) {
    this.downloadSub?.unsubscribe();
    this.downloadSub = undefined;
    this.isDownloading = false;
    this.close.emit(confirmed);
  }
}
