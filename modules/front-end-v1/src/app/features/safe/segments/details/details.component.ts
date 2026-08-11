import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'segment-details',
    templateUrl: './details.component.html',
    styleUrls: ['./details.component.less'],
    standalone: false
})
export class DetailsComponent {
  id: string;

  constructor(
    private route:ActivatedRoute
  ) {
    this.route.paramMap.subscribe( paramMap => {
      this.id = decodeURIComponent(paramMap.get('id'));
    })
  }
}
