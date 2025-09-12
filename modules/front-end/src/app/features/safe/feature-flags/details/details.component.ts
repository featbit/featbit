import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
    selector: 'segment-details',
    templateUrl: './details.component.html',
    styleUrls: ['./details.component.less'],
    standalone: false
})
export class DetailsComponent {
  public id: string;
  // decide which tutorial will be shown
  tutorial: string = '';

  constructor(
    private route:ActivatedRoute,
  ) {
    this.route.paramMap.subscribe( paramMap => {
      this.id = decodeURIComponent(paramMap.get('id'));
    })
  }

  ngOnInit(): void {
    this.route.paramMap.subscribe( paramMap => {
      this.id = decodeURIComponent(paramMap.get('id'));
    })

    this.route.queryParamMap.subscribe(queryMap => {
      if(queryMap.has('tutorial')) {
        this.tutorial = queryMap.get('tutorial');
      }
    })
  }
}
