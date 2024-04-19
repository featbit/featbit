import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { NzUploadChangeParam, NzUploadFile } from "ng-zorro-antd/upload";
import { NzMessageService } from "ng-zorro-antd/message";
import { Observable, Observer } from "rxjs";
import { GlobalUserService } from "@services/global-user.service";

@Component({
  selector: 'import-user',
  templateUrl: './import-user.component.html',
  styleUrls: ['./import-user.component.less']
})
export class ImportUserComponent implements OnInit {
  @Input()
  isVisible = false;
  @Output()
  close: EventEmitter<boolean> = new EventEmitter<boolean>();
  uploadUrl: string = '';

  constructor(
    private globalUserService: GlobalUserService,
    private msg: NzMessageService
  ) { }

  ngOnInit(): void {
    this.uploadUrl = this.globalUserService.uploadUrl();
  }

  beforeUpload = (file: NzUploadFile, _fileList: NzUploadFile[]): Observable<boolean> =>
    new Observable((observer: Observer<boolean>) => {
      const isJson = file.type === 'application/json';
      if (!isJson) {
        this.msg.warning($localize`:@@users.import.file-format-error:Invalid file format. Only JSON files are allowed.`);
        observer.complete();
        return;
      }

      const isLowerThan500Mb = file.size! / 1024 / 1024 < 500;
      if (!isLowerThan500Mb) {
        this.msg.warning($localize`:@@users.import.file-size-error:The uploaded file exceeds the size limit of 500MB. Please upload a smaller file.`);
        observer.complete();
        return;
      }

      observer.next(isJson && isLowerThan500Mb);
      observer.complete();
    });

  onCancel() {
    this.close.emit(false);
  }

  handleChange({file, fileList}: NzUploadChangeParam): void {
    const status = file.status;
    if (status !== 'uploading') {
      console.log(file, fileList);
    }
    if (status === 'done') {
      this.msg.success($localize`:@@users.import.import-success:User data has been successfully imported.`);
      this.close.emit(true);
    } else if (status === 'error') {
      this.msg.error($localize`:@@users.import.import-failed:Failed to import user data. Please check the file and try again.`);
    }
  }
}
