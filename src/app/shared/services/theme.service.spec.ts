import { TestBed } from '@angular/core/testing';
import { ThemeService, Theme } from './theme.service';

describe('ThemeService', () => {
  let service: ThemeService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ThemeService);
    // Clear localStorage before each test
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should default to light theme', () => {
    expect(service.getCurrentTheme()).toBe('light');
  });

  it('should toggle between light and dark themes', () => {
    expect(service.getCurrentTheme()).toBe('light');
    
    service.toggleTheme();
    expect(service.getCurrentTheme()).toBe('dark');
    
    service.toggleTheme();
    expect(service.getCurrentTheme()).toBe('light');
  });

  it('should set theme and persist to localStorage', () => {
    service.setTheme('dark');
    
    expect(service.getCurrentTheme()).toBe('dark');
    expect(localStorage.getItem('drec-theme')).toBe('dark');
  });

  it('should load saved theme from localStorage', () => {
    localStorage.setItem('drec-theme', 'dark');
    
    // Create new service instance to test initialization
    const newService = TestBed.inject(ThemeService);
    
    expect(newService.getCurrentTheme()).toBe('dark');
  });

  it('should emit theme changes', () => {
    let emittedTheme: Theme | null = null;
    
    service.theme$.subscribe(theme => {
      emittedTheme = theme;
    });
    
    service.setTheme('dark');
    
    expect(emittedTheme).toBe('dark' as Theme);
  });

  it('should update document body class', () => {
    service.setTheme('dark');
    
    expect(document.body.classList.contains('dark-theme')).toBe(true);
    expect(document.body.classList.contains('light-theme')).toBe(false);
    
    service.setTheme('light');
    
    expect(document.body.classList.contains('light-theme')).toBe(true);
    expect(document.body.classList.contains('dark-theme')).toBe(false);
  });
});