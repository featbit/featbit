import { inject, Injectable } from '@angular/core';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import { getCurrentProjectEnv } from '@utils/project-env';
import { ChangeCommentComponent } from '@core/components/change-comment/change-comment.component';
import { ChangeCommentData, ChangeOperation } from "@core/components/change-comment/types";

@Injectable()
export class ChangeCommentService {

  modalService = inject(NzModalService);

  prompt(data: ChangeCommentData): Observable<string | null> {
    const requireChangeComment = getCurrentProjectEnv()?.envSettings?.requireChangeComment;
    if (!requireChangeComment) {
      return of('');
    }

    const modalRef = this.modalService.create<ChangeCommentComponent, ChangeCommentData, string | null>({
      nzTitle: `Confirm ${data.resourceType} change`,
      nzContent: ChangeCommentComponent,
      nzData: data,
      nzFooter: null,
      nzMaskClosable: true,
      nzClosable: true,
      nzWidth: 480,
      nzClassName: 'change-comment-modal',
      nzCentered: true
    });

    return modalRef.afterClose.pipe(map(v => v ?? null));
  }

  promptFlag(flagKey: string, operation: ChangeOperation): Observable<string | null> {
    return this.prompt({ resourceType: 'flag', resourceKey: flagKey, operation });
  }

  promptSegment(segmentKey: string, operation: ChangeOperation): Observable<string | null> {
    return this.prompt({ resourceType: 'segment', resourceKey: segmentKey, operation });
  }
}
