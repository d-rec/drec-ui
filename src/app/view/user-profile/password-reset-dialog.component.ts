import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../auth/services';

@Component({
  standalone: false,
  selector: 'app-password-reset-dialog',
  templateUrl: './password-reset-dialog.component.html',
})
export class PasswordResetDialogComponent {
  resetpasswordform: FormGroup;
  hideOld = true;
  hide = true;
  hide1 = true;
  submitting = false;

  constructor(
    private dialogRef: MatDialogRef<PasswordResetDialogComponent>,
    private userService: UserService,
    private toastrService: ToastrService,
  ) {
    this.resetpasswordform = new FormGroup(
      {
        oldPassword: new FormControl('', [Validators.required]),
        newPassword: new FormControl('', [
          Validators.required,
          this.checkPassword,
        ]),
        confirmPassword: new FormControl('', [
          Validators.required,
          this.checkPassword,
        ]),
      },
      {
        validators: (control) => {
          const newPassword = control.get('newPassword')?.value;
          const confirmPassword = control.get('confirmPassword')?.value;
          const confirmCtrl = control.get('confirmPassword');
          if (
            newPassword !== null &&
            confirmPassword !== null &&
            newPassword !== confirmPassword
          ) {
            confirmCtrl?.setErrors({ notSame: true });
          } else if (confirmCtrl?.hasError('notSame')) {
            confirmCtrl.setErrors(null);
          }
          return null;
        },
      },
    );
  }

  checkPassword(control: any) {
    const enteredPassword = control.value;
    const passwordCheck = /((?=.*[0-9])(?=.*[A-Za-z]).{6,})/;
    return !passwordCheck.test(enteredPassword) && enteredPassword
      ? { requirements: true }
      : null;
  }

  getErrorPassword(controlName: string) {
    const ctrl = this.resetpasswordform.get(controlName);
    if (ctrl?.hasError('required')) return 'This field is required';
    if (ctrl?.hasError('requirements'))
      return 'Password must be at least 6 characters with letters and one number';
    if (ctrl?.hasError('notSame')) return 'Passwords do not match';
    return '';
  }

  checkValidation(input: string): boolean {
    const ctrl = this.resetpasswordform.get(input);
    return !!(ctrl?.invalid && (ctrl?.dirty || ctrl?.touched));
  }

  submit() {
    if (this.resetpasswordform.invalid || this.submitting) return;
    this.submitting = true;
    const { oldPassword, newPassword } = this.resetpasswordform.value;
    this.userService
      .updateOwnPassword({ oldPassword, newPassword })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.toastrService.success('Password updated', 'Successfully');
          this.dialogRef.close(true);
        },
        error: (err) => {
          this.submitting = false;
          this.toastrService.error(
            err?.error?.message ?? err?.message ?? 'Failed to update password',
            'Error',
          );
        },
      });
  }

  cancel() {
    this.dialogRef.close(false);
  }
}
