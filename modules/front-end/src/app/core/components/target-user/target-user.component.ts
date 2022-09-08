import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { IUserType } from '@shared/types';

@Component({
  selector: 'target-user',
  templateUrl: './target-user.component.html',
  styleUrls: ['./target-user.component.less']
})
export class TargetUserComponent implements OnInit {

  private inputs = new Subject<any>();
  public compareWith: (obj1: IUserType, obj2: IUserType) => boolean = (obj1: IUserType, obj2: IUserType) => {
    if(obj1 && obj2) {
      return obj1.id === obj2.id;
    } else {
      return false;
    }
  };

  @Input() type: string = '';
  @Input() tipIdx: number = 0;
  @Input() tipColor: string = '#7FFFD4';
  @Input() selectedUserDetailList: IUserType[];

  @Input("userList")
  set list(data: IUserType[]) {
    this.isLoading = false;
    this.userList = [...data];
  }

  @Output() search = new EventEmitter<string>();    // 搜索用户
  @Output() onSelectedUserListChange = new EventEmitter<IUserType[]>();      // 选择用户发生改变

  public userList: IUserType[] = [];                 // 用户列表
  public isLoading = false;                         // 数据加载中

  constructor() {
    this.inputs.pipe(
      debounceTime(500),
      distinctUntilChanged()
    ).subscribe(e => {
      this.search.next(e);
    });
  }

  ngOnInit(): void {
    if (this.selectedUserDetailList?.length > 0) {
      const usersNotInOptions = this.selectedUserDetailList.filter(su => !this.userList.find(u => u.id === su.id));
      this.userList = [...this.userList, ...usersNotInOptions];
    }
  }

  // 搜索用户
  public onSearch(value: string = '') {
    this.isLoading = true;
    this.inputs.next(value);
  }

  // 选择发生改变
  public onSelectChange() {
    this.onSelectedUserListChange.next(this.selectedUserDetailList);
  }
}
