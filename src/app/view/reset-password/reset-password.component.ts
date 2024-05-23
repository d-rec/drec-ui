import { Component } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { UserService } from '../../auth/services/user.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-reset-password',
  templateUrl: './reset-password.component.html',
  styleUrls: ['./reset-password.component.scss'],
})
export class ResetPasswordComponent {
  resetpasswordForm = new FormGroup(
    {
      newPassword: new FormControl(null, [
        Validators.required,
        this.checkPassword,
      ]),
      confirmPassword: new FormControl('', [
        Validators.required,
        this.checkconfirmPassword,
      ]),
    },
    {
      validators: (control) => {
        const newPassword = control.get('newPassword')?.value;
        const confirmPassword = control.get('confirmPassword')?.value;

        if (
          newPassword !== null &&
          confirmPassword !== null &&
          newPassword !== confirmPassword
        ) {
          control.get('confirmPassword')?.setErrors({ notSame: true });
        }
        return null;
      },
    },
  );
  hide = true;
  hide1 = true;
  matchconfirm: boolean = false;
  accesstoken: any;
  fromregister: boolean = true;
  message: string;
  email: string;
  role: string;
  constructor(
    private authService: UserService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
  ) {
    // this.accesstoken = this.activatedRoute.snapshot.params['id'];
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['token'] != undefined) {
        this.accesstoken = params['token'];
        this.email = params['email'];
        this.role = params['role'];
        this.fromregister = false;
        // this.getConfirmemail(this.accesstoken)
      }
    });
  }
  padBase64(token: any) {
    const base64 = token.replace('-', '+').replace('_', '/');
    return base64;
  }
  b64DecodeUnicode(token: any) {
    const base64Payload = window.atob(token);
    return base64Payload;
  }
  checkPassword(control: any) {
    const enteredPassword = control.value;
    const passwordCheck = /((?=.*[0-9])(?=.*[A-Za-z]).{6,})/;
    return !passwordCheck.test(enteredPassword) && enteredPassword
      ? { requirements: true }
      : null;
  }
  getErrorPassword() {
    return this.resetpasswordForm.get('newPassword')?.hasError('required')
      ? 'This field is required (Password must contain minimum 6 characters (upper and/or lower case) and at least one number)'
      : this.resetpasswordForm.get('newPassword')?.hasError('requirements')
        ? '(Password must contain minimum 6 characters (upper and/or lower case) and at least one number)'
        : '';
  }
  checkconfirmPassword(control: any) {
    const enteredPassword = control.value;
    const passwordCheck = /((?=.*[0-9])(?=.*[A-Za-z]).{6,})/;

    return !passwordCheck.test(enteredPassword) && enteredPassword
      ? { Confirmrequirements: true }
      : !enteredPassword && enteredPassword
        ? { matchrequirements: true }
        : null;
  }
  getErrorcheckconfirmPassword() {
    return this.resetpasswordForm.get('confirmPassword')?.hasError('required')
      ? 'This field is required (Password must contain minimum 6 characters (upper and/or lower case) and at least one number)'
      : this.resetpasswordForm
            .get('confirmPassword')
            ?.hasError('Confirmrequirements')
        ? '(Password must contain minimum 6 characters (upper and/or lower case) and at least one number)'
        : this.resetpasswordForm.get('confirmPassword')?.hasError('notSame')
          ? ' confirmPassword Does not match'
          : '';
  }
  checkValidation(input: string) {
    const validation =
      this.resetpasswordForm.get(input)?.invalid &&
      (this.resetpasswordForm.get(input)?.dirty ||
        this.resetpasswordForm.get(input)?.touched);
    return validation;
  }
  onSubmit() {
    this.authService
      .UserResetPassword(this.accesstoken, this.resetpasswordForm.value)
      .subscribe((data) => {
        this.toastrService.success('Successfully!!', data.firstName+'Reset Password');

        this.router.navigate(['/login']);
      });
  }
}
