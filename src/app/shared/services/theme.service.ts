import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_KEY = 'drec-theme';
  private themeSubject = new BehaviorSubject<Theme>('light');
  
  public theme$ = this.themeSubject.asObservable();

  constructor() {
    const savedTheme = this.getSavedTheme();
    this.setTheme(savedTheme);
  }

  private getSavedTheme(): Theme {
    const savedTheme = localStorage.getItem(this.THEME_KEY) as Theme;
    return savedTheme || 'light';
  }

  public setTheme(theme: Theme): void {
    this.themeSubject.next(theme);
    localStorage.setItem(this.THEME_KEY, theme);
    this.updateDocumentTheme(theme);
  }

  public getCurrentTheme(): Theme {
    return this.themeSubject.value;
  }

  public toggleTheme(): void {
    const currentTheme = this.getCurrentTheme();
    const newTheme: Theme = currentTheme === 'light' ? 'dark' : 'light';
    this.setTheme(newTheme);
  }

  private updateDocumentTheme(theme: Theme): void {
    const body = document.body;
    body.classList.remove('light-theme', 'dark-theme');
    body.classList.add(`${theme}-theme`);
  }
}