import { Component, OnInit } from '@angular/core';

@Component({
    selector: 'end-user',
    template: `<router-outlet></router-outlet>`,
    standalone: false
})
export class EndUsersComponent implements OnInit {

  constructor() { }

  ngOnInit(): void {
  }

}
