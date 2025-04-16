import { Component } from '@angular/core';
import { UserService } from '../../auth/services/user.service';
import { ToastrService } from 'ngx-toastr';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
@Component({
  selector: 'app-terms-and-conditions',
  templateUrl: './terms-and-conditions.component.html',
  styleUrls: ['./terms-and-conditions.component.scss'],
})
export class TermsAndConditionsComponent {
  termsForm: FormGroup;
  isSubmitting = false;
  email: string = JSON.parse(sessionStorage.getItem('loginuser') || '{}').email;
  constructor(
    private fb: FormBuilder,
    private userService: UserService,
    private toastrService: ToastrService,
    private router: Router,
  ) {
    this.termsForm = this.fb.group({
      termsAndConditions: [false, Validators.requiredTrue],
    });
  }

  onSubmit() {
    this.isSubmitting = true;
    this.termsAndConditions(this.email);
  }

  termsAndConditions(email: string) {
    this.userService.acceptTermsAndConditions(email).subscribe({
      next: () => {
        const redirectUrl = sessionStorage.getItem('redirectUrl');
        if (redirectUrl) {
          this.router.navigateByUrl(redirectUrl);
          sessionStorage.removeItem('redirectUrl');
        }
        this.toastrService.success(
          'Successful !!',
          'Terms and Conditions Accepted',
        );
      },
      error: (err) => {
        this.toastrService.error('Error', err.error);
      },
    });
  }
  logout() {
    sessionStorage.clear();
    this.router.navigate(['/login']);
  }
}
