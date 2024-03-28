import {Component, Input, OnInit} from '@angular/core';

interface GroupedItem {
  name: string;
  items: Item[];
}

interface Item {
  id: string;
  name: string;
}

@Component({
  selector: 'resource-finder',
  templateUrl: './resource-finder.component.html',
  styleUrls: ['./resource-finder.component.less']
})
export class ResourceFinderComponent implements OnInit {
  @Input()
  isVisible = false;
  @Input()
  resources: string[] = ['Projects', 'Environments', 'Flags', 'Segments']

  groupedItems: GroupedItem[] = [];

  constructor() {
  }

  ngOnInit(): void {
    this.groupedItems = this.resources.map(resource => {
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
  }
}
