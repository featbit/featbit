import { Component, OnDestroy, OnInit } from '@angular/core';
import { getAuth } from 'src/app/utils';
import { Subject } from 'rxjs';
import { IAuthProps } from 'src/app/config/types';
import { UserService } from "src/app/services/user.service";

@Component({
  selector: 'initialization',
  templateUrl: './initialization.component.html',
  styleUrls: ['./initialization.component.less']
})
export class InitializationComponent implements OnInit, OnDestroy {
  public auth: IAuthProps;
  private destory$: Subject<void> = new Subject();
  public menuExtended: boolean = false;

  toggleMenu(extended: boolean) {
    this.menuExtended = extended;
  }

  constructor(private userService: UserService) { }

  ngOnInit(): void {
    this.auth = getAuth();
  }

  ngOnDestroy(): void {
    this.destory$.next();
    this.destory$.complete();
  }

  async logout() {
    await this.userService.doLogoutUser();
  }
}
