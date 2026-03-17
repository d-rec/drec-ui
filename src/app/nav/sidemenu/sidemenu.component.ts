import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import { getRoleName } from '../../utils/role-helper';
import { RoleModeService } from '../../auth/services/role-mode.service';

@Component({
  selector: 'app-sidemenu',
  templateUrl: './sidemenu.component.html',
  styleUrls: ['./sidemenu.component.scss'],
})
export class SidemenuComponent implements OnInit, OnDestroy {
  loginuser: any;
  showmenu: boolean;
  devcieurl: string;
  Alluserurl: string;
  adduserorg_url: string;
  isApiMode: boolean;
  getRoleName = getRoleName;

  private modeSubscription: Subscription;

  constructor(
    private router: Router,
    private roleModeService: RoleModeService,
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

  ngOnDestroy() {
    this.modeSubscription?.unsubscribe();
  }

  private updateUrls(): void {
    if (this.isApiMode) {
      this.devcieurl = '/apiuser/All_devices';
      this.Alluserurl = './apiuser/All_users';
      this.adduserorg_url = '/apiuser/add_user';
    } else {
      this.devcieurl = '/device/AllList';
      this.Alluserurl = './admin/All_users';
      this.adduserorg_url = '/admin/add_user';
    }
  }

  logout() {
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }
}
