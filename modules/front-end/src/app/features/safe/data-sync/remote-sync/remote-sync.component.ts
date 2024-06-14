import { Component, OnInit } from '@angular/core';
import { DataSyncService } from "@services/data-sync.service";
import { EnvSettingService } from "@services/env-setting.service";
import { NzMessageService } from "ng-zorro-antd/message";
import { EnvironmentSettingTypes } from "@shared/types";
import { format } from "date-fns";
import { catchError } from "rxjs/operators";
import { forkJoin, of } from "rxjs";
import { uuidv4 } from "@utils/index";

interface SyncResult {
  success: boolean;
  time: string;
}

interface SyncUrlSettingRow {
  id: string;
  key: string;
  value: string;
  tag?: string;
  remark?: string;
  isSaving?: boolean;
  isEditing?: boolean;
  isDeleting?: boolean;
  isSyncing?: boolean;
  syncResult?: SyncResult;
}

@Component({
  selector: 'remote-sync',
  templateUrl: './remote-sync.component.html',
  styleUrls: ['./remote-sync.component.less']
})
export class RemoteSyncComponent implements OnInit {

  constructor(
    private dataSyncService: DataSyncService,
    private settingService: EnvSettingService,
    private message: NzMessageService
  ) {
  }

  ngOnInit(): void {
    this.isLoading = true;
    // init sync urls
    this.settingService.get(EnvironmentSettingTypes.SyncUrls).subscribe(
      settings => {
        this.allSettings = settings.map(s => Object.assign({}, {syncResult: this.getSyncResult(s.remark)}, s));
        this.filteredSettings = this.allSettings;

        // set tags
        this.refreshTags(settings);

        // load finish
        this.isLoading = false;
      }
    );
  }

  // get sync result from remark
  getSyncResult(remark: string): SyncResult {
    if (!remark) {
      return;
    }

    const success = remark.split(',')[0] === 'true';
    const timestamp = remark.split(',')[1];
    const time = format(parseInt(timestamp), 'yyyy-MM-dd HH:mm');

    return { success, time };
  }

  isLoading: boolean = false;

  // settings
  allSettings: SyncUrlSettingRow[] = [];
  filteredSettings: SyncUrlSettingRow[] = [];

  // tags
  tags = [];
  filterTag: string = '';

  refreshTags(settings: SyncUrlSettingRow[]) {
    let newTags = [];
    settings.map(s => s.tag).forEach(tag => {
      if (tag && newTags.indexOf(tag) === -1) {
        newTags.push(tag);
      }
    });

    this.tags = newTags;
  }

  edit(row: SyncUrlSettingRow) {
    row.isEditing = true;
  }

  save(row: SyncUrlSettingRow) {
    row.isSaving = true;

    const setting = {
      id: row.id,
      type: EnvironmentSettingTypes.SyncUrls,
      key: row.key,
      value: row.value,
      tag: row.tag
    };

    this.settingService.upsert([setting]).subscribe(() => {
      row.remark = '';
      row.isSaving = false;
      row.isEditing = false;
      this.message.success($localize `Success`);
    });
  }

  isSyncingAll: boolean = false;
  syncAll() {
    this.isSyncingAll = true;
    this.filteredSettings.forEach(row => row.isSyncing = true);

    let tasks = [];
    this.filteredSettings.forEach(row => {
      let task = this.dataSyncService.syncToRemote(row.id)
        .pipe(catchError(error => of(`error, sync url is '${row.value}'`)));

      tasks.push(task);
    });

    const observable = forkJoin(tasks);
    observable.subscribe(results => {
      this.filteredSettings.forEach((row, index) => {
        this.handleSyncResponse(row, results[index] as string);
      });

      this.isSyncingAll = false;
    });
  }

  sync(row: SyncUrlSettingRow): void {
    row.isSyncing = true;

    this.dataSyncService.syncToRemote(row.id).subscribe(response => {
      this.handleSyncResponse(row, response);
    }, error => {
      row.isSyncing = false;
      this.message.error(`error, sync url is '${row.value}'`);
    });
  }

  private handleSyncResponse(row: SyncUrlSettingRow, response: string) {
    row.isSyncing = false;

    if (response.startsWith('error')) {
      this.message.error(response);
      return;
    }

    row.remark = response;
    row.syncResult = this.getSyncResult(response);
  }

  newRow(): void {
    let newRow = {
      id: uuidv4(),
      key: '',
      value: '',
      isEditing: true
    };

    this.allSettings = [...this.allSettings, newRow];
    this.filteredSettings = [...this.filteredSettings, newRow];
  }

  deleteRow(row: SyncUrlSettingRow): void {
    row.isDeleting = true;
    this.settingService.delete(row.id).subscribe(() => {
      this.allSettings = this.allSettings.filter(d => d.id !== row.id);
      this.filteredSettings = this.filteredSettings.filter(d => d.id !== row.id);

      this.message.success($localize `Success`);

      this.refreshTags(this.allSettings);
      row.isDeleting = false;
    });
  }

  filterRow() {
    this.filteredSettings = this.allSettings.filter(s => {
      if (this.filterTag) {
        return s.tag === this.filterTag;
      } else {
        return true;
      }
    });
  }

  newTag(el: HTMLInputElement): void {
    const tag = el.value;
    if (tag) {
      this.tags = [...this.tags, tag];
    }

    el.value = '';
  }
}
