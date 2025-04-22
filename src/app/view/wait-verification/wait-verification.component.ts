import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthbaseService } from '../../auth/authbase.service';

@Component({
  selector: 'app-wait-verification',
  templateUrl: './wait-verification.component.html',
  styleUrls: ['./wait-verification.component.scss'],
})
export class WaitVerificationComponent {
  constructor(
    private authService: AuthbaseService,
    private router: Router,
  ) {}

  logout(): void {
    sessionStorage.removeItem('access-token');
    this.authService.logout('auth/logout').subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      },
    });
  }
}
