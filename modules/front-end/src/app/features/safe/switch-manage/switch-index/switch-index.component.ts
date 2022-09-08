import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { Subject } from 'rxjs';
import { SwitchService } from '@services/switch.service';
import { IFfParams } from '../types/switch-new';
import { encodeURIComponentFfc } from '@shared/utils';
import { SwitchTagTreeService } from "@services/switch-tag-tree.service";
import {
  SwitchListCheckItem,
  SwitchListFilter,
  SwitchListItem,
  SwitchListModel,
  SwitchTagTree
} from "../types/switch-index";
import { SwitchV2Service } from "@services/switch-v2.service";
import { debounceTime, first, map, switchMap } from 'rxjs/operators';
import { FormBuilder, FormControl, FormGroup, Validators } from "@angular/forms";
import { getCurrentAccount, getCurrentProjectEnv } from "@utils/project-env";
import { ProjectService } from "@services/project.service";
import { IEnvironment } from "@shared/types";
import { NzNotificationService } from "ng-zorro-antd/notification";

@Component({
  selector: 'index',
  templateUrl: './switch-index.component.html',
  styleUrls: ['./switch-index.component.less']
})
export class SwitchIndexComponent implements OnInit {

  // tag tree
  tagTreeModalVisible: boolean = false;
  tagTree: SwitchTagTree = new SwitchTagTree([]);

  // table selection
  allChecked: boolean = false;
  indeterminate: boolean = false;
  onAllChecked(checked: boolean): void {
    this.listOfCurrentPageData
      .forEach(item => this.updateCheckedSet(this.getItemKey(item), checked));

    this.refreshCheckedStatus();
  }

  listOfCurrentPageData: SwitchListItem[] = [];
  onCurrentPageDataChange(data: SwitchListItem[]) {
    this.listOfCurrentPageData = data;
    this.refreshCheckedStatus();
  }

  refreshCheckedStatus(): void {
    let currentPageData = this.listOfCurrentPageData;

    this.allChecked = currentPageData.length > 0 && currentPageData.every(item => this.itemChecked(item));
    this.indeterminate = !this.allChecked && currentPageData.some(item => this.itemChecked(item));
  }

  getItemKey(item: SwitchListItem) {
    return `${item.id};${item.name};`;
  }

  parseItemKey(key: string): { id: string, name: string } {
    let [id, name] = key.split(';');
    return { id, name };
  }

  itemChecked(item: SwitchListItem): boolean {
    const key = this.getItemKey(item);

    return this.checkedItemKeys.has(key);
  }

  checkedItemKeys = new Set<string>();
  updateCheckedSet(key: string, checked: boolean) {
    if (checked) {
      this.checkedItemKeys.add(key);
    } else {
      this.checkedItemKeys.delete(key);
    }
  }

  onItemChecked(item: SwitchListItem): void {
    const key = this.getItemKey(item);
    const checked = this.checkedItemKeys.has(key);

    this.updateCheckedSet(key, !checked);
    this.refreshCheckedStatus();
  }

  // batch copy
  batchCopyVisible: boolean = false;
  checkedItems: SwitchListCheckItem[] = [];
  get totalSelected() {
    return this.checkedItems.filter(x => x.checked).length;
  }

  envs: IEnvironment[] = [];
  targetEnv: IEnvironment;
  selectTargetEnv(env: IEnvironment) {
    this.targetEnv = env;
  }
  openBatchCopyModal() {
    if (this.checkedItemKeys.size === 0) {
      this.msg.warning('请先选择需要复制的开关');
      return;
    }

    this.checkedItems = [];
    for (const key of this.checkedItemKeys) {
      const { id, name } = this.parseItemKey(key);
      this.checkedItems.push({ id, name, checked: true });
    }

    this.batchCopyVisible = true;
  }

  isCopying: boolean = false;
  batchCopy() {
    this.isCopying = true;

    this.switchV2Service
      .copyToEnv(this.targetEnv.id, this.checkedItems.filter(x => x.checked).map(x => x.id))
      .subscribe(copyToEnvResult => {
        this.isCopying = false;
        this.batchCopyVisible = false;
        this.checkedItemKeys.clear();
        this.refreshCheckedStatus();

        if (copyToEnvResult.ignored.length > 0) {
          this.notification.warning(
            '复制结果',
            `
            成功复制<strong> ${copyToEnvResult.copiedCount} </strong>个开关到环境 <strong>${this.targetEnv.name}</strong>
            <br/>以下开关由于<strong>目标环境已存在而被忽略</strong> <br/> ${copyToEnvResult.ignored.join(', ')}`,
            { nzDuration: 0 }
          );
        } else {
          this.notification.success(
            '复制成功',
            `成功复制 <strong>${copyToEnvResult.copiedCount}</strong> 个开关到环境 <strong>${this.targetEnv.name}</strong>`
          );
        }
      }, _ => {
        this.isCopying = false;
      });
  }

  //#region v2 switch list

  switchListModel: SwitchListModel = {
    items: [],
    totalCount: 0
  };

  v2Loading: boolean = true;
  compareAndCopyFlag: boolean = true;

  loadSwitchListV2() {
    this.v2Loading = true;
    this.switchV2Service
      .getList(this.switchFilterV2)
      .subscribe((switches: SwitchListModel) => {
        this.switchListModel = switches;
        this.v2Loading = false;
      });
  }

  loadSwitchListV20220621() {
    this.v2Loading = true;
    this.switchV2Service
      .getListV20220621(this.switchFilterV2)
      .subscribe((switches: SwitchListModel) => {
        if (switches && switches.items && switches.items.length > 0) {
          for (let i = 0; i < switches.items.length; i++) {
            let item = switches.items[i];
            item.variationOverview.variationsWhenOn = item.variationOverview.variationsWhenOn.sort(function(a, b){return a.localId - b.localId;});
            item.variationOverview.variationsWhenOnStr =  item.variationOverview.variationsWhenOn.map(p=>p.variationValue);
          }
        }
        this.switchListModel = switches;
        this.v2Loading = false;
      });
  }

  switchFilterV2: SwitchListFilter = new SwitchListFilter();

  onSelectTagV2(nodeIds: number[]) {
    this.switchFilterV2.tagIds = nodeIds;

    this.onSearchV2();
  }

  $searchV2: Subject<void> = new Subject();

  onSearchV2(resetPage?: boolean) {
    if (resetPage) {
      this.switchFilterV2.pageIndex = 1;
    }
    this.$searchV2.next();
  }

  //#endregion

  //#region v2 create switch
  createModalVisibleV2: boolean = false;
  switchFormV2: FormGroup;

  switchNameValidator = (control: FormControl) => {
    const name = control.value;
    if (!name) {
      return { error: true, required: true };
    }

    if (name.includes('__')) {
      return { error: true, invalid_character: true };
    }
  }

  switchNameAsyncValidator = (control: FormControl) => control.valueChanges.pipe(
    debounceTime(300),
    switchMap(value => this.switchV2Service.isNameUsed(value as string)),
    map(isNameUsed => {
      switch (isNameUsed) {
        case true:
          return { error: true, duplicated: true };
        case undefined:
          return { error: true, unknown: true };
        default:
          return null;
      }
    }),
    first()
  );

  creatingV2: boolean = false;

  createSwitchV2() {
    this.creatingV2 = true;

    const name = this.switchFormV2.get('name').value;

    this.switchServe.createNewSwitch(name)
      .subscribe((result: IFfParams) => {
        this.switchServe.setCurrentSwitch(result);
        this.toSwitchDetail(result.id);
        this.creatingV2 = false;
      }, err => {
        this.msg.error(err.error);
        this.creatingV2 = false;
      });
  }

  closeCreateModalV2() {
    this.createModalVisibleV2 = false;
    this.switchFormV2.reset();
  }

  //#endregion

  constructor(
    private router: Router,
    public switchServe: SwitchService,
    private switchV2Service: SwitchV2Service,
    private msg: NzMessageService,
    private switchTagTreeService: SwitchTagTreeService,
    private fb: FormBuilder,
    private projectService: ProjectService,
    private notification: NzNotificationService
  ) {
    this.switchFormV2 = this.fb.group({
      name: ['', [this.switchNameValidator], [this.switchNameAsyncValidator], 'change'],
      keyName: [{ value: '', disabled: true }, [Validators.required]]
    });

    this.compareAndCopyFlag = false;
  }

  ngOnInit(): void {
    let currentProjectEnv = getCurrentProjectEnv();

    this.switchServe.envId = currentProjectEnv.envId;

    // get switch tag tree
    this.switchTagTreeService.getTree()
      .subscribe(res => this.tagTree = res);

    // get switch list
    this.$searchV2.pipe(
      debounceTime(400)
    ).subscribe(() => {
      this.loadSwitchListV20220621();
    });
    this.$searchV2.next();

    // get current envs
    const curAccountId = getCurrentAccount().id;
    const curProjectId = currentProjectEnv.projectId;
    const curEnvId = currentProjectEnv.envId;

    this.projectService.getProject(curAccountId, curProjectId)
      .pipe(map(project => project.environments))
      .subscribe(envs => {
        this.envs = envs.filter(x => x.id !== curEnvId);
        this.targetEnv = this.envs[0];
      });
  }

  // 切换开关状态
  onChangeSwitchStatus(data: IFfParams): void {
    if (data.status === 'Enabled') {
      this.switchServe.changeSwitchStatus(data.id, 'Disabled')
        .subscribe(_ => {
          this.msg.success(`开关 ${data.name} 已切换至关闭状态`);
          data.status = 'Disabled';
        }, _ => {
          this.msg.error('开关状态切换失败!');
        });
    } else if (data.status === 'Disabled') {
      this.switchServe.changeSwitchStatus(data.id, 'Enabled')
        .subscribe(_ => {
          this.msg.success(`开关 ${data.name}已切换至开启状态`);
          data.status = 'Enabled';
        }, _ => {
          this.msg.error('开关状态切换失败!');
        });
    }
  }

  // 点击进入对应开关详情
  public onIntoSwitchDetail(data: IFfParams) {
    this.switchServe.setCurrentSwitch(data);
    this.toSwitchDetail(data.id);
  }

  // 点击进入对比与复制开关页面
  public onIntoCompareAndCopy() {
    this.router.navigateByUrl('/compare-and-copy');
  }

  // 路由跳转
  private toSwitchDetail(id: string) {
    this.router.navigateByUrl(`/switch-manage/${encodeURIComponentFfc(id)}/targeting`);
  }

  // 转换本地时间
  getLocalDate(date: string) {
    if (!date) return '';
    return new Date(date);
  }

  // copy keyName
  copyText(event, text: string) {
    navigator.clipboard.writeText(text).then(
      () => this.msg.success('复制成功')
    );
  }

  // 保存标签树
  saveTagTree() {
    this.switchTagTreeService.saveTree(this.tagTree)
      .subscribe(savedTagTree => {
        // for trigger change detection
        this.tagTree = savedTagTree;

        // update switch tags when save tagTree
        for (const switchItem of this.switchListModel.items) {
          switchItem.tags = this.tagTree.getSwitchTags(switchItem.id);
        }

        this.msg.success('保存成功!');
      }, err => {
        this.msg.error(err.error);
      });

    // close modal
    this.tagTreeModalVisible = false;
  }
}
