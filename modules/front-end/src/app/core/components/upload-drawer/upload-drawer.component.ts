import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzUploadChangeParam } from 'ng-zorro-antd/upload';
import { EnvUserService } from "@services/env-user.service";

@Component({
  selector: 'app-upload-drawer',
  templateUrl: './upload-drawer.component.html',
  styleUrls: ['./upload-drawer.component.less']
})
export class UploadDrawerComponent implements OnInit {

  uploadUrl: string = null;
  isUploading: boolean = false;

  @Input() visible: boolean = false;
  @Output() close: EventEmitter<any> = new EventEmitter();

  constructor(
    private endUserService: EnvUserService,
    private message: NzMessageService,
  ) { }

  ngOnInit(): void {
    this.uploadUrl = this.endUserService.uploadUrl();
  }

  onClose() {
    this.close.emit();
  }

  handleChange(info: NzUploadChangeParam): void {
    let status = info.file.status;

    this.isUploading = status === 'uploading';
    if (this.isUploading) {
      return;
    }

    if (status === 'error') {
      this.message.error(`${info.file.name} ` + $localize `:@@upload-failed:upload failed`);
      return;
    }

    if (status === 'done') {
      this.message.success(`${info.file.name} ` + $localize `:@@upload-success:upload success`);
      this.onClose();
    }
  }
}
