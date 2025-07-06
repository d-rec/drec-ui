import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ThemeSwitcherComponent } from './theme-switcher.component';
import { ThemeService } from '../../services/theme.service';
import { MaterialModule } from '../../../material/material.module';
import { BehaviorSubject } from 'rxjs';

describe('ThemeSwitcherComponent', () => {
  let component: ThemeSwitcherComponent;
  let fixture: ComponentFixture<ThemeSwitcherComponent>;
  let mockThemeService: jasmine.SpyObj<ThemeService>;
  let themeSubject: BehaviorSubject<'light' | 'dark'>;

  beforeEach(async () => {
    themeSubject = new BehaviorSubject<'light' | 'dark'>('light');
    
    mockThemeService = jasmine.createSpyObj('ThemeService', ['toggleTheme'], {
      theme$: themeSubject.asObservable()
    });

    await TestBed.configureTestingModule({
      declarations: [ThemeSwitcherComponent],
      imports: [MaterialModule],
      providers: [
        { provide: ThemeService, useValue: mockThemeService }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ThemeSwitcherComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with light theme', () => {
    expect(component.currentTheme).toBe('light');
    expect(component.isDarkMode).toBe(false);
  });

  it('should update when theme changes', () => {
    themeSubject.next('dark');
    fixture.detectChanges();
    
    expect(component.currentTheme).toBe('dark');
    expect(component.isDarkMode).toBe(true);
  });

  it('should toggle theme when button is clicked', () => {
    const button = fixture.nativeElement.querySelector('button');
    button.click();
    
    expect(mockThemeService.toggleTheme).toHaveBeenCalled();
  });

  it('should display correct icon for light theme', () => {
    component.currentTheme = 'light';
    fixture.detectChanges();
    
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.textContent.trim()).toBe('dark_mode');
  });

  it('should display correct icon for dark theme', () => {
    component.currentTheme = 'dark';
    fixture.detectChanges();
    
    const icon = fixture.nativeElement.querySelector('mat-icon');
    expect(icon.textContent.trim()).toBe('light_mode');
  });

  it('should have correct aria-label for accessibility', () => {
    const button = fixture.nativeElement.querySelector('button');
    
    component.currentTheme = 'light';
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Switch to dark mode');
    
    component.currentTheme = 'dark';
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Switch to light mode');
  });
});