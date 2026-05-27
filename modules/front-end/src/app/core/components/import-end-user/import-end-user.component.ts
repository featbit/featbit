import { Component, EventEmitter, Input, Output } from '@angular/core';
import { NzUploadChangeParam, NzUploadFile } from 'ng-zorro-antd/upload';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Observable, Observer } from 'rxjs';

@Component({
  selector: 'import-end-user',
  templateUrl: './import-end-user.component.html',
  styleUrls: [ './import-end-user.component.less' ],
  standalone: false
})
export class ImportEndUserComponent {
  @Input()
  visible: boolean = false;

  @Input()
  uploadUrl: string = '';

  @Input()
  templateUrl: string = '';

  @Output()
  close = new EventEmitter<boolean>();

  isUploading: boolean = false;

  constructor(private message: NzMessageService) {
  }

  beforeUpload = (file: NzUploadFile, _fileList: NzUploadFile[]): Observable<boolean> =>
    new Observable((observer: Observer<boolean>) => {
      const isJson = file.type === 'application/json';
      if (!isJson) {
        this.message.warning($localize`:@@users.import.file-format-error:Invalid file format. Only JSON files are allowed.`);
        observer.complete();
        return;
      }

      const isLowerThan500Mb = file.size! / 1024 / 1024 < 500;
      if (!isLowerThan500Mb) {
        this.message.warning($localize`:@@users.import.file-size-error:The uploaded file exceeds the size limit of 500MB. Please upload a smaller file.`);
        observer.complete();
        return;
      }

      observer.next(true);
      observer.complete();
    });

  onClose(): void {
    this.close.emit(false);
  }

  handleChange({ file }: NzUploadChangeParam): void {
    this.isUploading = file.status === 'uploading';
    if (this.isUploading) {
      return;
    }

    if (file.status === 'done') {
      this.message.success($localize`:@@users.import.import-success:User data has been successfully imported.`);
      this.close.emit(true);
    } else if (file.status === 'error') {
      this.message.error($localize`:@@users.import.import-failed:Failed to import user data. Please check the file and try again.`);
    }
  }
}
