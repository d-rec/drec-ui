import { Component } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'app-wait-verification',
  templateUrl: './wait-verification.component.html',
  styleUrls: ['./wait-verification.component.scss'],
})
export class WaitVerificationComponent {
  constructor(private router: Router) {}

  goBack() {
    this.router.navigate(['/documents-upload']);
  }

  goToDashboard() {
    this.router.navigate(['/dashboard']);
  }
}
