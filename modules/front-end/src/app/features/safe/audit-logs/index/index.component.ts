import {Component, OnDestroy, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {NzMessageService} from 'ng-zorro-antd/message';
import {Subject} from 'rxjs';
import {AuditLogListFilter, IAuditLogListModel, RefTypeEnum} from "../types/audit-logs";
import {debounceTime, distinctUntilChanged} from 'rxjs/operators';
import {AuditLogService} from "@services/audit-log.service";
import {MemberService} from "@services/member.service";
import {IMember, IMemberListModel, MemberFilter} from "@features/safe/iam/types/member";

@Component({
  selector: 'auditlogs-index',
  templateUrl: './index.component.html',
  styleUrls: ['./index.component.less']
})
export class IndexComponent implements OnInit, OnDestroy {
  private destory$: Subject<void> = new Subject();

  listModel: IAuditLogListModel = {
    items: [],
    totalCount: 0
  };

  memberListModel: IMemberListModel = {
    items: [],
    totalCount: 0
  }

  loading: boolean = true;
  membersLoading: boolean = false;
  refTypeFlag: RefTypeEnum = RefTypeEnum.Flag;

  loadAuditLogList() {
    this.loading = true;
    this.auditLogService
      .getList(this.auditLogFilter)
      .subscribe((auditLogs: IAuditLogListModel) => {
        this.listModel = auditLogs;
        this.loading = false;
      });
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

  auditLogFilter: AuditLogListFilter = new AuditLogListFilter();

  private $search: Subject<void> = new Subject();
  private $memberSearch = new Subject<any>();

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

  onDateRangeChange(result: Date[]): void {
    this.auditLogFilter.pageIndex = 1;
    this.$search.next();
  }

  constructor(
    private router: Router,
    private auditLogService: AuditLogService,
    private memberService: MemberService,
    private msg: NzMessageService,
  ) {
  }

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

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }

  getLocalDate(date: string) {
    if (!date) return '';
    return new Date(date);
  }

  getMemberLabel(member: IMember): string {
    let label = member.email;

    if (member.name?.length > 0) {
      label += ` (${member.name})`
    }

    return label;
  }
}
