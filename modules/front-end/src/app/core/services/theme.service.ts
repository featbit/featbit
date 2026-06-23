import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { NzConfigService } from 'ng-zorro-antd/core/config';
import { THEME } from '@utils/localstorage-keys';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const THEME_ATTRIBUTE = 'data-theme';
// Cap Monaco polling at 10s; Monaco normally finishes loading well under 1s.
const MONACO_POLL_TIMEOUT_MS = 10_000;
const MONACO_POLL_INTERVAL_MS = 500;

@Injectable({ providedIn: 'root' })
export class ThemeService {
  // Initialise from storage in the field initialiser so the resolved theme is
  // correct even if a consumer reads it before init() runs. The inline script
  // in index.html applies data-theme synchronously to avoid FOUC, but this
  // keeps the in-memory state consistent.
  private readonly preferenceSubject = new BehaviorSubject<ThemePreference>(
    this.readStoredPreference()
  );
  private readonly resolvedSubject = new BehaviorSubject<ResolvedTheme>('light');
  private readonly mediaQuery: MediaQueryList | null;
  private readonly mediaQueryListener: ((e: MediaQueryListEvent) => void) | null;
  // Single live poll handle for Monaco theme application. Toggling the theme
  // multiple times before Monaco has loaded would otherwise spawn parallel
  // intervals.
  private monacoPollHandle: number | null = null;

  constructor(private nzConfigService: NzConfigService) {
    this.mediaQuery = typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-color-scheme: dark)')
      : null;

    this.mediaQueryListener = this.mediaQuery
      ? () => {
          if (this.preferenceSubject.value === 'system') {
            this.applyResolvedTheme();
          }
        }
      : null;

    if (this.mediaQuery && this.mediaQueryListener) {
      this.mediaQuery.addEventListener('change', this.mediaQueryListener);
    }
  }

  init(): void {
    this.preferenceSubject.next(this.readStoredPreference());
    this.applyResolvedTheme();
  }

  preference$(): Observable<ThemePreference> {
    return this.preferenceSubject.asObservable();
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
      if (typeof localStorage === 'undefined') return 'system';
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
    const apply = (): boolean => {
      if (typeof window === 'undefined') return false;
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

    // Cancel any in-flight poll from a previous theme change before starting
    // a new one (prevents parallel intervals when the user toggles rapidly).
    this.clearMonacoPoll();
    if (apply()) return;

    // Monaco loads lazily via nz-code-editor's AMD loader. Poll briefly until
    // window.monaco is defined, then apply the current theme.
    const start = Date.now();
    this.monacoPollHandle = window.setInterval(() => {
      if (apply() || Date.now() - start > MONACO_POLL_TIMEOUT_MS) {
        this.clearMonacoPoll();
      }
    }, MONACO_POLL_INTERVAL_MS);
  }

  private clearMonacoPoll(): void {
    if (this.monacoPollHandle !== null && typeof window !== 'undefined') {
      window.clearInterval(this.monacoPollHandle);
    }
    this.monacoPollHandle = null;
  }
}
