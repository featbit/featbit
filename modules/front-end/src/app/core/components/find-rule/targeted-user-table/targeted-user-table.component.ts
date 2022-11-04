import { Component, Input, OnInit } from '@angular/core';
import { IJsonContent } from "@features/safe/feature-flags/types/switch-new";
import { EnvUserService } from "@services/env-user.service";
import { IUserType } from "@shared/types";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import { debounceTime } from "rxjs/operators";
import {getPathPrefix} from "@utils/index";

@Component({
  selector: 'targeted-user-table',
  templateUrl: './targeted-user-table.component.html',
  styleUrls: ['./targeted-user-table.component.less']
})
export class TargetedUserTableComponent implements OnInit {

  @Input()
  rules: IJsonContent[] = [];

  isLoading = true;
  total: number = 0;
  pageIndex: number = 1;
  pageSize: number = 5;

  users: IUserType[] = [];

  searchName: string = '';
  $search: Subject<string> = new Subject();

  constructor(
    private envUserService: EnvUserService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.getUsers();

    this.$search.pipe(
      debounceTime(350)
    ).subscribe(() => {
      this.getUsers();
    });
  }

  getUsers() {
    this.isLoading = true;

    const searchRules = [...this.rules];
    if (this.searchName) {
      searchRules.push({
        multipleValue: [],
        operation: "Contains",
        property: "Name",
        type: "string",
        value: this.searchName,
      })
    }

    this.envUserService.targetedUsers(searchRules, this.pageIndex - 1, this.pageSize)
      .subscribe(pagedResult => {
        this.users = pagedResult.items;
        this.total = pagedResult.totalCount;
        this.isLoading = false;
      });
  }

  onSearch() {
    this.pageIndex = 1;
    this.$search.next(null);
  }

  onPageIndexChange() {
    this.getUsers();
  }

  navigateToUserDetail(user: IUserType) {
    const url = this.router.serializeUrl(
      this.router.createUrlTree([`${getPathPrefix()}users/${encodeURIComponent(user.id)}`])
    );

    window.open(url, '_blank');
  }
}
