import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NzConfigService } from 'ng-zorro-antd/core/config';
import { THEME } from '@utils/localstorage-keys';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_ATTRIBUTE = 'data-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly preferenceSubject = new BehaviorSubject<ThemePreference>('system');
  private readonly resolvedSubject = new BehaviorSubject<ResolvedTheme>('light');
  private readonly mediaQuery: MediaQueryList | null;

  constructor(private nzConfigService: NzConfigService) {
    this.mediaQuery = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    this.mediaQuery?.addEventListener('change', () => {
      if (this.preferenceSubject.value === 'system') {
        this.applyResolvedTheme();
      }
    });
  }

  init(): void {
    this.preferenceSubject.next(this.readStoredPreference());
    this.applyResolvedTheme();
  }

  preference$(): Observable<ThemePreference> {
    return this.preferenceSubject.asObservable();
  }

  resolved$(): Observable<ResolvedTheme> {
    return this.resolvedSubject.asObservable();
  }

  getPreference(): ThemePreference {
    return this.preferenceSubject.value;
  }

  getResolvedTheme(): ResolvedTheme {
    return this.resolvedSubject.value;
  }

  setPreference(preference: ThemePreference): void {
    if (preference === this.preferenceSubject.value) {
      return;
    }

    this.preferenceSubject.next(preference);

    try {
      localStorage.setItem(THEME, preference);
    } catch {
      // localStorage may be unavailable (private mode, quota); fail silently.
    }

    this.applyResolvedTheme();
  }

  private readStoredPreference(): ThemePreference {
    try {
      const value = localStorage.getItem(THEME);
      if (value === 'light' || value === 'dark' || value === 'system') {
        return value;
      }
    } catch {
      // ignore
    }
    return 'system';
  }

  private resolveTheme(preference: ThemePreference): ResolvedTheme {
    if (preference === 'system') {
      return this.mediaQuery?.matches ? 'dark' : 'light';
    }
    return preference;
  }

  private applyResolvedTheme(): void {
    const resolved = this.resolveTheme(this.preferenceSubject.value);
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (resolved === 'dark') {
        root.setAttribute(THEME_ATTRIBUTE, 'dark');
      } else {
        root.removeAttribute(THEME_ATTRIBUTE);
      }
    }
    if (resolved !== this.resolvedSubject.value) {
      this.resolvedSubject.next(resolved);
    }
    this.applyMonacoTheme(resolved);
  }

  private applyMonacoTheme(resolved: ResolvedTheme): void {
    if (typeof window === 'undefined') return;
    const themeName = resolved === 'dark' ? 'vs-dark' : 'vs';
    // Update the default option used by nz-code-editor for editors created
    // after this point.
    try {
      this.nzConfigService.set('codeEditor', {
        defaultEditorOption: { theme: themeName }
      });
    } catch {
      // ignore
    }
    const apply = () => {
      const monaco = (window as any).monaco;
      if (monaco?.editor?.setTheme) {
        try {
          monaco.editor.setTheme(themeName);
          return true;
        } catch {
          return false;
        }
      }
      return false;
    };
    if (apply()) return;
    // Monaco loads lazily via nz-code-editor's AMD loader. Poll briefly until
    // window.monaco is defined, then apply the current theme.
    const start = Date.now();
    const interval = window.setInterval(() => {
      if (apply() || Date.now() - start > 30_000) {
        window.clearInterval(interval);
      }
    }, 500);
  }
}
