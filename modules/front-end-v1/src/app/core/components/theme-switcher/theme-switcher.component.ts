import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ThemePreference, ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-theme-switcher',
  templateUrl: './theme-switcher.component.html',
  styleUrls: ['./theme-switcher.component.less'],
  standalone: false
})
export class ThemeSwitcherComponent implements OnInit, OnDestroy {
  preference: ThemePreference = 'system';

  private readonly destroy$ = new Subject<void>();

  constructor(private readonly themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.preference$()
      .pipe(takeUntil(this.destroy$))
      .subscribe(preference => (this.preference = preference));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setPreference(preference: ThemePreference): void {
    this.themeService.setPreference(preference);
  }
}
