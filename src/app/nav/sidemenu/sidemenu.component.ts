import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-sidemenu',
  templateUrl: './sidemenu.component.html',
  styleUrls: ['./sidemenu.component.scss'],
})
export class SidemenuComponent implements OnInit {
  loginuser: any;
  showmenu: boolean;
  devcieurl: string;
  Alluserurl: string;
  adduserorg_url: string;
  constructor(private router: Router) {}
  ngOnInit() {
    this.showmenu = environment.production;
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    if (this.loginuser?.role === 'ApiUser') {
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
