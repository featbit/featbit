import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'create-feature-flag',
  templateUrl: './create-feature-flag.component.html',
  styleUrls: ['./create-feature-flag.component.less']
})
export class CreateFeatureFlagComponent implements OnInit {

  @Input() flagKey: string = 'the-flag-key';
  @Input() envSecret: string = 'the-env-secret';

  ngOnInit() {
  }
}
