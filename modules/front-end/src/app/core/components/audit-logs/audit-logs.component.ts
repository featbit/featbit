import { Component, Input, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { AuditLogListFilter, IAuditLog, IAuditLogListModel, RefTypeEnum } from "@core/components/audit-log/types";
import { IMember, IMemberListModel, MemberFilter } from "@features/safe/iam/types/member";
import { AuditLogService } from "@services/audit-log.service";
import { MemberService } from "@services/member.service";
import { debounceTime, distinctUntilChanged } from "rxjs/operators";
import { NzMessageService } from "ng-zorro-antd/message";

@Component({
  selector: 'audit-logs',
  templateUrl: './audit-logs.component.html',
  styleUrls: ['./audit-logs.component.less']
})
export class AuditLogsComponent implements OnInit {
  @Input() auditLogFilter: AuditLogListFilter;
  @Input() isEmbedded: boolean = true;

  private $search: Subject<void> = new Subject();
  private $memberSearch = new Subject<any>();
  loading: boolean = true;
  membersLoading: boolean = false;
  memberListModel: IMemberListModel = {
    items: [],
    totalCount: 0
  }
  auditLogs: IAuditLog[] = [];
  groupedAuditLogs: {key: string, items: IAuditLog[]}[] = [];
  totalCount: number = 0;
  refTypeFlag: RefTypeEnum = RefTypeEnum.Flag;
  refTypeSegment: RefTypeEnum = RefTypeEnum.Segment;
  constructor(
    private auditLogService: AuditLogService,
    private memberService: MemberService,
    private msg: NzMessageService,
  ) { }

  ngOnInit(): void {
    this.$memberSearch.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(e => {
      this.loadMemberList(e);
    });

    this.$search.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.loadAuditLogList();
    });

    this.$search.next();
  }

  loadAuditLogList() {
    this.loading = true;
    this.auditLogService
      .getList(this.auditLogFilter)
      .subscribe((auditLogs: IAuditLogListModel) => {
        this.totalCount = auditLogs.totalCount;

        if (this.auditLogFilter.pageIndex === 1) {
          this.auditLogs = auditLogs.items;
        } else {
          this.auditLogs = [...this.auditLogs, ...auditLogs.items];
        }

        this.groupedAuditLogs = this.auditLogs
          .map((auditLog) => ({...auditLog, createdDateStr: auditLog.createdAt.slice(0,10)}))
          .sort((auditLog) => new Date(auditLog.createdAt).getTime())
          .reduce((acc, cur) => {
            let auditLogsByDate = acc.find((itm) => itm.key === cur.createdDateStr);
            if (auditLogsByDate) {
              auditLogsByDate.items = [...auditLogsByDate.items, cur];
            } else {
              auditLogsByDate = [cur];
              acc = [...acc, { key: cur.createdDateStr, items: auditLogsByDate }];
            }

            return acc;
          }, []);

        this.loading = false;
      });
  }

  loadMoreAuditLogs() {
    this.auditLogFilter.pageIndex++;

    this.loadAuditLogList();
  }

  loadMemberList(query?: string) {
    this.membersLoading = true;
    this.memberService.getList(new MemberFilter(query ?? '')).subscribe({
      next: (members) => {
        this.memberListModel = members;
        this.membersLoading = false;
      },
      error: () => {
        this.msg.error($localize `:@@auditlogs.idx.failed-to-load-members:Failed to load team members`);
        this.membersLoading = false;
      }
    })
  }

  onSearch(resetPage?: boolean) {
    if (resetPage) {
      this.auditLogFilter.pageIndex = 1;
    }
    this.$search.next();
  }

  public onMemberSearch(value: string = '') {
    this.membersLoading = true;
    this.$memberSearch.next(value);
  }

  onDateRangeChange(): void {
    this.auditLogFilter.pageIndex = 1;
    this.$search.next();
  }

  getMemberLabel(member: IMember): string {
    let label = member.email;

    if (member.name?.length > 0) {
      label += ` (${member.name})`;
    }

    return label;
  }
}
