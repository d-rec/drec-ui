import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-header',
  templateUrl: './header.component.html',
  styleUrls: ['./header.component.scss'],
})
export class HeaderComponent implements OnInit {
  isLoggedIn = false;
  @Output() public sidenavToggle = new EventEmitter();

  constructor(
    private authService: AuthbaseService,
    private toastrService: ToastrService,
    private router: Router,
  ) {}

  ngOnInit() {
    this.isLoggedIn = this.authService.isLoggedIn();
    if (!this.isLoggedIn) {
      this.router.navigate(['/login']);
    }
  }
  public onToggleSidenav = () => {
    this.sidenavToggle.emit();
  };
  logout() {
    this.authService.logout('auth/logout').subscribe({
      next: (data) => {
        this.toastrService.success(data.message);
        sessionStorage.clear();
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.toastrService.success(err, 'logout Successfull');
        this.router.navigate(['/login']);
      },
    });
  }
}
