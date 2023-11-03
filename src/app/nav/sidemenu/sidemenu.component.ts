import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
@Component({
  selector: 'app-sidemenu',
  templateUrl: './sidemenu.component.html',
  styleUrls: ['./sidemenu.component.scss']
})
export class SidemenuComponent implements OnInit {
  loginuser: any;
  showmenu: Boolean;
  devcieurl: string;
  constructor(private router: Router) {


  }
  ngOnInit() {
    this.showmenu = environment.production;
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    if (this.loginuser?.role === 'ApiUser') {
      this.devcieurl ='/apiuser/All_devices'
    } else {
      this.devcieurl ='/device/AllList'
    }
  }
  logout() {

    sessionStorage.clear();
    this.router.navigate(['/login']);

  }
}
