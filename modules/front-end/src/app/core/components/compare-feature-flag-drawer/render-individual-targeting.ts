import { Component, Input } from "@angular/core";
import { IFeatureFlag } from "@features/safe/feature-flags/types/details";
import { SlicePipe } from "@angular/common";
import { NzToolTipModule } from 'ng-zorro-antd/tooltip';

@Component({
  selector: 'render-individual-targeting',
  template: `
    @if (data.flag.targetUsers.length === 0) {
      <span class="empty-state-text" i18n="@@ff.compare.no-individual-targeting">No Individual Targeting</span>
    } @else {
      @for (variationUser of variationUsers; track variationUser.variation.id) {
        <div class="individual-targeting-entry">
          <div class="variation-header">
          <span
            class="variation-badge"
            nz-tooltip
            [nzTooltipTitle]="variationUser.variation.value"
          >
            {{ variationUser.variation.name }}
          </span>
          </div>
          <div class="users-list">
            @for (user of (variationUser.users | slice:0:10); track user) {
              <span class="user-badge" nz-tooltip [nzTooltipTitle]="user">{{ user }}</span>
            }
            @if (variationUser.users.length > 10) {
              <span class="more-users-badge">
              +{{ variationUser.users.length - 10 }} more
            </span>
            }
          </div>
        </div>
      }
    }
  `,
  imports: [
    SlicePipe,
    NzToolTipModule
  ],
  standalone: true,
  styles: `
    .empty-state-text {
      color: #8c8c8c;
      font-style: italic;
    }

    .individual-targeting-entry {
      margin-bottom: 12px;

      &:last-child {
        margin-bottom: 0;
      }
    }

    .users-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    }

    .user-badge {
      display: inline-block;
      padding: 4px 8px;
      background-color: #ffffff;
      border: 1px solid #d9d9d9;
      border-radius: 12px;
      font-size: 12px;
      color: #717D8A;
      transition: all 0.2s ease;
      cursor: default;
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      vertical-align: middle;

      &:hover {
        border-color: #40a9ff;
        background-color: #f0f7ff;
        transform: translateY(-1px);
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      }
    }

    .more-users-badge {
      display: inline-flex;
      align-items: center;
      padding: 4px 8px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border: none;
      border-radius: 12px;
      font-size: 12px;
      color: #ffffff;
      box-shadow: 0 2px 4px rgba(102, 126, 234, 0.3);
      cursor: default;
    }

    .variation-header {
      margin-bottom: 8px;
    }

    .variation-badge {
      padding: 2px 8px;
      color: #8c8c8c;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      cursor: help;
    }
  `
})
export class RenderIndividualTargeting {
  @Input()
  data: { flag: IFeatureFlag }

  get variationUsers() {
    const flag = this.data.flag;

    return flag.targetUsers.map(tu => ({
      variation: flag.variations.find(v => v.id === tu.variationId),
      users: tu.keyIds,
    }));
  }
}
