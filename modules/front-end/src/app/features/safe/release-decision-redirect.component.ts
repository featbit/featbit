import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-release-decision-redirect',
  template: '',
  standalone: true
})
export class ReleaseDecisionRedirectComponent implements OnInit {
  constructor(private route: ActivatedRoute) {}

  ngOnInit(): void {
    const flagKey = this.findRouteParam('key');
    const url = flagKey
      ? `/release-decision/?flagKey=${encodeURIComponent(flagKey)}`
      : '/release-decision/';

    window.location.assign(url);
  }

  private findRouteParam(name: string): string | null {
    let route: ActivatedRoute | null = this.route;
    while (route) {
      const value = route.snapshot.paramMap.get(name);
      if (value) return decodeURIComponent(value);
      route = route.parent;
    }

    return null;
  }
}
