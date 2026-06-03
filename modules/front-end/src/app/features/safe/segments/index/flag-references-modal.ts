import { Component, EventEmitter, inject, Input, OnInit, Output } from "@angular/core";
import { ISegmentFlagReference } from "../types/segments";
import { NzModalComponent, NzModalContentDirective, NzModalFooterDirective } from "ng-zorro-antd/modal";
import { NzButtonComponent } from "ng-zorro-antd/button";
import { getPathPrefix } from "@utils/index";
import { Router } from "@angular/router";
import { getCurrentProjectEnv } from "@utils/project-env";

@Component({
  selector: 'flag-references-modal',
  template: `
    <nz-modal
      nzClassName="flag-references-modal"
      [(nzVisible)]="visible"
      nzCentered
      nzWidth="450px"
      [nzTitle]="title"
      (nzOnCancel)="close()">
      <ng-container *nzModalContent>
        @if (references.length > 0) {
          @if (description) {
            <p class="description">{{ description }}</p>
          }
          <div class="reference-list">
            @for (reference of references; track reference.id) {
              <div class="reference-item"
                   [class.reference-item-disabled]="!canOpenReference(reference)"
                   (click)="openFlagPage(reference)">
                <span class="reference-name">{{ reference.name }}</span>
                <span class="reference-key">{{ reference.key }}</span>
                @if (!canOpenReference(reference)) {
                  <span class="reference-env" i18n="@@segment.details.not-in-this-environment">(not in this environment)</span>
                }
              </div>
            }
          </div>
        } @else {
          <p class="description" i18n="@@segment.index.flag-references-modal-empty">No feature flags are referencing
            this segment.</p>
        }
      </ng-container>
      <ng-container *nzModalFooter>
        <div class="actions">
          <button nz-button nzType="primary" (click)="close()" i18n="@@common.ok">Ok</button>
        </div>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .description {
      margin-bottom: 8px;
      color: #717D8A;
    }

    .reference-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .reference-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #F1F2F7;
      cursor: pointer;
      transition: background-color 0.2s;

      &:hover {
        background-color: #F1F1F1;

        .reference-link-icon {
          opacity: 1;
        }
      }
    }

    .reference-item-disabled {
      cursor: default;
      opacity: 0.7;

      &:hover {
        background-color: transparent;
      }
    }

    .reference-name {
      flex: 1;
      font-weight: 500;
      color: #373F47;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .reference-key {
      font-size: 12px;
      color: #717D8A;
      background-color: #FAFAFA;
      border: 1px solid #EAECEE;
      border-radius: 4px;
      padding: 1px 6px;
      flex-shrink: 0;
    }

    .reference-env {
      font-size: 12px;
      color: #717D8A;
      flex-shrink: 0;
    }

    .actions {
      button {
        height: unset;
        width: unset;
      }
    }
  `,
  imports: [
    NzModalComponent,
    NzModalContentDirective,
    NzModalFooterDirective,
    NzButtonComponent
  ]
})
export class FlagReferencesModalComponent implements OnInit {
  router = inject(Router);

  @Input()
  visible: boolean = false;

  @Input()
  references: ISegmentFlagReference[] = [];

  @Input()
  title: string;

  @Input()
  description: string;

  @Output()
  onClose = new EventEmitter<void>();

  currentEnvId: string;
  ngOnInit(): void {
    this.currentEnvId = getCurrentProjectEnv().envId;
  }

  close() {
    this.onClose.emit();
  }

  canOpenReference(reference: ISegmentFlagReference): boolean {
    if (!this.currentEnvId || !reference.envId) {
      return true;
    }

    return reference.envId === this.currentEnvId;
  }

  openFlagPage(reference: ISegmentFlagReference) {
    if (!this.canOpenReference(reference)) {
      return;
    }

    const url = this.router.serializeUrl(
      this.router.createUrlTree([ `/${getPathPrefix()}feature-flags/${reference.key}/targeting` ])
    );

    window.open(url, '_blank');
  }
}
