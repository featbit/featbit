import { Component, OnInit } from '@angular/core';
import { IDENTITY_TOKEN } from "@utils/localstorage-keys";
import { Router } from "@angular/router";

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.less']
})
export class LoginComponent implements OnInit {

  constructor(private router: Router) { }

  async ngOnInit() {
    const token = localStorage.getItem(IDENTITY_TOKEN);
    if (token) {
      await this.router.navigateByUrl('/');
    }
  }
}
