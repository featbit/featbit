import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { Subject } from "rxjs";
import { debounceTime, map } from 'rxjs/operators';
import { EnvUserPropService } from "@services/env-user-prop.service";
import { IUserProp } from "@shared/types";

@Component({
    selector: 'app-user-detail',
    templateUrl: './details.component.html',
    styleUrls: ['./details.component.less'],
    standalone: false
})
export class DetailsComponent implements OnInit {

  $search: Subject<string> = new Subject();

  searchValue: string = '';
  userId: string;

  builtInKeys = ['keyId', 'name'];

  propertyList = [];
  searchResult = [];

  envUserProps: IUserProp[] = [];

  constructor(
    private route: ActivatedRoute,
    private envUserPropService: EnvUserPropService
  ) { }

  ngOnInit(): void {
    this.$search.pipe(
      debounceTime(100)
    ).subscribe((query) => {
      const regex = new RegExp(query, 'gi');
      this.searchResult = this.propertyList.filter(p => regex.test(p.name) || regex.test(p.value));
    });

    this.listenerResolveData();

    this.envUserPropService.get().subscribe(props => this.envUserProps = props);
  }

  getPropRemark(propName: string) {
    const envUserProp = this.envUserProps.find(prop => prop.name === propName);
    return envUserProp ? envUserProp.remark : '';
  }

  onSearch() {
    this.$search.next(this.searchValue);
  }

  listenerResolveData() {
    this.route.data
      .pipe(
        map(res => res.envUser)
      )
      .subscribe(res => {
        const user = res;
        if (res) {
          if (!res.customizedProperties) {
            this.propertyList = this.builtInKeys.map(key => ({
              name: key,
              value: user[key]
            }));
          } else {
            this.propertyList = [...this.builtInKeys.map(key => ({
                name: key,
                value: user[key]
              })),
              ...user.customizedProperties
            ];
          }

          this.searchResult = [...this.propertyList];
        }
      });
  }
}
