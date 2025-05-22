import { UserService } from '../../../app/auth/services/user.service';
import { Component } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import {
  getPhoneNumberErrorMessage,
  phoneNumberValidator,
} from '../../../app/shared/validators/phone-validators';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-change-phone-number',
  templateUrl: './change-phone-number.component.html',
  styleUrls: ['./change-phone-number.component.scss'],
})
export class ChangePhoneNumberComponent {
  changePhoneNumberForm: FormGroup;
  constructor(
    private userService: UserService,
    private toastrService: ToastrService,
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
    if (this.changePhoneNumberForm.valid) {
      const phoneNumber = this.changePhoneNumberForm.get('phoneNumber')?.value;
      this.userService.updatProfile(phoneNumber).subscribe({
        next: (response) => {
          this.toastrService.success();
          console.log('Phone number updated successfully:', response);
        },
        error: (error) => {
          console.error('Error updating phone number:', error);
        },
      });
      // Handle the form submission logic here
    } else {
      this.changePhoneNumberForm.markAllAsTouched();
    }
  }
}
