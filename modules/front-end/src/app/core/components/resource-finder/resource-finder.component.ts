import {Component, Input} from '@angular/core';

@Component({
  selector: 'resource-finder',
  templateUrl: './resource-finder.component.html',
  styleUrls: ['./resource-finder.component.less']
})
export class ResourceFinderComponent {
  @Input()
  isVisible = false;

  resources = ['Projects', 'Environments', 'Flags', 'Segments'];

  groupedItems = this.resources.map(resource => {
    return {
      name: resource,
      items: [
        {
          id: "1",
          name: 'Resource 1',
        },
        {
          id: "2",
          name: 'Resource 2',
        },
        {
          id: "3",
          name: 'Resource 3',
        }
      ]
    };
  });

  constructor() {
  }
}
