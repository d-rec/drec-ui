import { UserService } from '../../../app/auth/services/user.service';
import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  getPhoneNumberErrorMessage,
  phoneNumberValidator,
} from '../../../app/shared/validators/phone-validators';
import { ToastrService } from 'ngx-toastr';
import { Router } from '@angular/router';

@Component({
  selector: 'app-change-phone-number',
  templateUrl: './change-phone-number.component.html',
})
export class ChangePhoneNumberComponent {
  changePhoneNumberForm: FormGroup;
  constructor(
    private userService: UserService,
    private toastrService: ToastrService,
    private router: Router,
  ) {
    this.createForm();
  }

  createForm() {
    this.changePhoneNumberForm = new FormGroup({
      phoneNumber: new FormControl(null, [
        Validators.required,
        phoneNumberValidator(),
      ]),
    });
  }

  phoneNumberErrors() {
    return getPhoneNumberErrorMessage(
      this.changePhoneNumberForm.get('phoneNumber'),
    );
  }

  markAsTouched(controlName: string): void {
    const control = this.changePhoneNumberForm.get(controlName);
    if (control) {
      control.markAsTouched();
      control.updateValueAndValidity();
    }
  }

  showPhoneNumberError(): boolean {
    const control = this.changePhoneNumberForm.get('phoneNumber');
    if (!control) return false;
    return control.invalid && (control.value || control.touched);
  }

  onSubmit() {
    const phoneNumber = this.changePhoneNumberForm
      .get('phoneNumber')
      ?.value.replace(/\s+/g, '');
    this.userService.updatePhoneNumber(phoneNumber).subscribe({
      next: () => {
        this.toastrService.success('Phone number updated successfully');
        this.toastrService.success('Otp sent to your phone number');
        this.router.navigate(['/verify-otp']);
      },
      error: (error) => {
        this.toastrService.error(error.error.message);
      },
    });
  }
}
