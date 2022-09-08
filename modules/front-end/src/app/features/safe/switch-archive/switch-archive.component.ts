import { Component, OnInit } from '@angular/core';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { Subject } from 'rxjs';
import { SwitchService } from '@services/switch.service';
import { AccountService } from '@services/account.service';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IFfParams } from "@features/safe/switch-manage/types/switch-new";
import { encodeURIComponentFfc } from "@utils/index";
import { Router } from "@angular/router";
import { SwitchV2Service } from "@services/switch-v2.service";

@Component({
  selector: 'app-switch-archive',
  templateUrl: './switch-archive.component.html',
  styleUrls: ['./switch-archive.component.less']
})
export class SwitchArchiveComponent implements OnInit {

  private search$ = new Subject<any>();
  currentEnvId: number;
  currentAccountId: number;
  searchText: string = '';
  isLoading: boolean = true;
  switchLoading: boolean = false;
  switchLists: IFfParams[] = [];

  constructor(
    private switchService: SwitchService,
    private switchV2Service: SwitchV2Service,
    private accountService: AccountService,
    private modal: NzModalService,
    private message: NzMessageService,
    private router: Router
  ) { }

  ngOnInit(): void {
    const currentAccountProjectEnv = this.accountService.getCurrentAccountProjectEnv();
    this.currentAccountId = currentAccountProjectEnv.account.id;
    this.currentEnvId = currentAccountProjectEnv.projectEnv.envId;
    this.init();
    this.search$.next('');
  }

  onSearch() {
    this.search$.next(this.searchText);
  }

  private init() {
    this.search$.pipe(
      debounceTime(300),
      distinctUntilChanged()
    ).subscribe(e => {
      this.isLoading = true;
      this.switchService.getArchiveSwitch(this.currentEnvId, {searchText: e}).subscribe(res => {
        this.isLoading = false;
        this.switchLists = res;
      }, _ => {
        this.message.error("数据加载失败，请重试!");
        this.isLoading = false;
      })
    });
  }

  // 复位开关
  onUnArchive(ff: IFfParams) {
    this.switchLoading = true;

    const disabledValue = ff.variationOptionWhenDisabled.variationValue;
    this.modal.confirm({
      nzContent: `开关复位后将<strong>处于关闭状态</strong>，开关返回值将是 <strong>${disabledValue}</strong> 。请您再次确认以避免给线上环境造成影响。`,
      nzTitle: '确定复位开关么？',
      nzCentered: true,
      nzClassName: 'information-modal-dialog',
      nzOnOk: () => {
        this.switchService.unarchiveEnvFeatureFlag(ff.id, ff.name)
          .subscribe(
            _ => {
              this.switchLists = this.switchLists.filter(s => s.id !== ff.id);
              this.message.success('开关复位成功！');
              this.search$.next(this.searchText);
            },
            _ => {
              this.message.error('开关复位失败，请稍后重试！');
            }
          );
      }
    });
    this.switchLoading = false;
  }

  deleteFlag(theSwitch: IFfParams) {
    this.switchV2Service.delete(theSwitch.id).subscribe(success => {
      if (success) {
        this.switchLists = this.switchLists.filter(s => s.id !== theSwitch.id);
        this.message.success('删除成功');
      } else {
        this.message.error('删除失败，请联系运营人员。');
      }
    });
  }

  // 转换本地时间
  getLocalDate(date: string) {
    if (!date) return '';
    return new Date(date);
  }

  navigateToDetail(theSwitch: IFfParams) {
    this.router.navigateByUrl(`/switch-manage/${encodeURIComponentFfc(theSwitch.id)}/targeting`);
  }
}
