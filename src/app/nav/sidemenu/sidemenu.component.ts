import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ViewChild,
  ElementRef,
  AfterViewInit,
} from '@angular/core';
import { MatSidenavContent } from '@angular/material/sidenav';
import { MAT_EXPANSION_PANEL_DEFAULT_OPTIONS } from '@angular/material/expansion';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getRoleName } from '../../utils/role-helper';
import { RoleModeService } from '../../auth/services/role-mode.service';

const STORAGE_KEY = 'sidenav-width';
const EXPANSION_STORAGE_KEY = 'sidenav-expansion-state';
const MIN_WIDTH = 150;
const MAX_WIDTH = 400;
const DEFAULT_WIDTH = 200;

@Component({
  standalone: false,
  selector: 'app-sidemenu',
  templateUrl: './sidemenu.component.html',
  styleUrls: ['./sidemenu.component.scss'],
  providers: [
    { provide: MAT_EXPANSION_PANEL_DEFAULT_OPTIONS, useValue: { expandedHeight: '32px', collapsedHeight: '32px', togglePosition: 'before' } },
  ],
})
export class SidemenuComponent implements OnInit, AfterViewInit, OnDestroy {
  loginuser: any;
  showmenu: boolean;
  devcieurl: string;
  Alluserurl: string;
  adduserorg_url: string;
  isApiMode: boolean;
  getRoleName = getRoleName;

  @ViewChild(MatSidenavContent, { read: ElementRef })
  private contentRef: ElementRef;
  sidenavWidth: number = this.loadWidth();
  expandedState: Record<string, boolean> = this.loadExpandedState();
  private isResizing = false;
  private modeSubscription: Subscription;

  constructor(
    private router: Router,
    private roleModeService: RoleModeService,
    private hostRef: ElementRef,
  ) {}

  ngOnInit() {
    this.showmenu = environment.production;
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    if (!this.loginuser) {
      return this.logout();
    }
    this.modeSubscription = this.roleModeService.mode.subscribe((mode) => {
      this.isApiMode = mode === 'api';
      this.updateUrls();
    });
  }

  ngAfterViewInit() {
    this.applyWidth(this.sidenavWidth);
  }

  ngOnDestroy() {
    this.modeSubscription?.unsubscribe();
  }

  onResizeStart(event: MouseEvent): void {
    this.isResizing = true;
    event.preventDefault();
  }

  @HostListener('document:mousemove', ['$event'])
  onMouseMove(event: MouseEvent): void {
    if (!this.isResizing) return;
    const newWidth = Math.min(Math.max(event.clientX, MIN_WIDTH), MAX_WIDTH);
    this.applyWidth(newWidth);
  }

  @HostListener('document:mouseup')
  onMouseUp(): void {
    if (!this.isResizing) return;
    this.isResizing = false;
    const w = this.currentWidth();
    this.sidenavWidth = w;
    localStorage.setItem(STORAGE_KEY, String(w));
  }

  private applyWidth(width: number): void {
    this.hostRef.nativeElement.style.setProperty(
      '--sidenav-width',
      width + 'px',
    );
    if (this.contentRef) {
      this.contentRef.nativeElement.style.setProperty(
        'margin-left',
        width + 'px',
        'important',
      );
    }
  }

  private currentWidth(): number {
    const val = getComputedStyle(this.hostRef.nativeElement).getPropertyValue(
      '--sidenav-width',
    );
    return parseInt(val) || DEFAULT_WIDTH;
  }

  isExpanded(key: string): boolean {
    return !!this.expandedState[key];
  }

  setExpanded(key: string, expanded: boolean): void {
    if (expanded) {
      this.expandedState = { [key]: true };
    } else {
      this.expandedState[key] = false;
    }
    localStorage.setItem(
      EXPANSION_STORAGE_KEY,
      JSON.stringify(this.expandedState),
    );
  }

  private loadExpandedState(): Record<string, boolean> {
    try {
      const stored = localStorage.getItem(EXPANSION_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }

  private loadWidth(): number {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored
      ? Math.min(Math.max(Number(stored), MIN_WIDTH), MAX_WIDTH)
      : DEFAULT_WIDTH;
  }

  private updateUrls(): void {
    if (this.isApiMode) {
      this.devcieurl = '/registrant/All_devices';
      this.Alluserurl = './registrant/All_users';
      this.adduserorg_url = '/organization/user/invitation';
    } else {
      this.devcieurl = '/device/AllList';
      this.Alluserurl = './admin/All_users';
      this.adduserorg_url = this.loginuser?.role === 'Admin'
        ? '/admin/add_user'
        : '/organization/user/invitation';
    }
  }

  logout() {
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }
}
