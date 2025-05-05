import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router } from '@angular/router';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../auth/services';
import { EMAIL_REGEX } from '../../constants/index';
import {
  phoneNumberValidator,
  getPhoneNumberErrorMessage,
} from '../../shared/validators/phone-validators';
import { decodeJwtToken, storeUserSession } from '../../utils/token-utils';

@Component({
  selector: 'app-register',
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  providers: [
    {
      provide: STEPPER_GLOBAL_OPTIONS,
      useValue: { showError: true },
    },
  ],
})
export class RegisterComponent implements OnInit {
  registerForm: FormGroup;
  fieldRequired: string = 'This field is required';
  orgtype: any[] = [
    { value: 'Developer', viewValue: 'Developer' },
    { value: 'Buyer', viewValue: 'Buyer' },
    { value: 'ApiUser', viewValue: 'Market Intermediary' },
  ];
  hide = true;
  hide1 = true;
  matchconfirm: boolean = false;
  showPopup: boolean = false;
  response: any;

  constructor(
    private authService: AuthbaseService,
    private toastrService: ToastrService,
    private router: Router,
    private userService: UserService,
  ) {}

  ngOnInit() {
    this.createForm();
  }

  createForm() {
    this.registerForm = new FormGroup(
      {
        firstName: new FormControl(null, [Validators.required]),
        lastName: new FormControl(null, [Validators.required]),
        orgName: new FormControl(null, [Validators.required]),
        organizationType: new FormControl(null),
        orgAddress: new FormControl(null),
        email: new FormControl(null, [
          Validators.required,
          Validators.pattern(EMAIL_REGEX),
        ]),
        phoneNumber: new FormControl(null, [
          Validators.required,
          phoneNumberValidator(),
        ]),
        password: new FormControl(null, [
          Validators.required,
          this.checkPassword,
        ]),
        confirmPassword: new FormControl('', [
          Validators.required,
          this.checkConfirmPassword,
        ]),
        termsAndConditions: new FormControl(false, [Validators.requiredTrue]),
      },
      {
        validators: (control) => {
          const password = control.get('password')?.value;
          const confirmPassword = control.get('confirmPassword')?.value;

          if (
            password !== null &&
            confirmPassword !== null &&
            password !== confirmPassword
          ) {
            control.get('confirmPassword')?.setErrors({ notSame: true });
          }
          return null;
        },
      },
    );
  }

  emaiErrors() {
    return this.registerForm.get('email')?.hasError('required')
      ? 'This field is required'
      : this.registerForm.get('email')?.hasError('pattern')
        ? 'Not a valid emailaddress'
        : '';
  }

  phoneNumberErrors() {
    return getPhoneNumberErrorMessage(this.registerForm.get('phoneNumber'));
  }

  markAsTouched(controlName: string): void {
    const control = this.registerForm.get(controlName);
    if (control) {
      control.markAsTouched();
      control.updateValueAndValidity();
    }
  }

  showPhoneNumberError(): boolean {
    const control = this.registerForm.get('phoneNumber');
    if (!control) return false;
    return control.invalid && (control.value || control.touched);
  }

  checkPassword(control: any) {
    const enteredPassword = control.value;
    const passwordCheck = /((?=.*[0-9])(?=.*[A-Za-z]).{6,})/;
    return !passwordCheck.test(enteredPassword) && enteredPassword
      ? { requirements: true }
      : null;
  }
  getErrorPassword() {
    return this.registerForm.get('password')?.hasError('required')
      ? 'This field is required (Password must contain minimum 6 characters (upper and/or lower case) and at least one number)'
      : this.registerForm.get('password')?.hasError('requirements')
        ? '(Password must contain minimum 6 characters (upper and/or lower case) and at least one number)'
        : '';
  }
  checkConfirmPassword(control: any) {
    const enteredPassword = control.value;
    const passwordCheck = /((?=.*[0-9])(?=.*[A-Za-z]).{6,})/;
    //this.registerForm.value.password = this.registerForm.value.password?:'';
    return !passwordCheck.test(enteredPassword) && enteredPassword
      ? { Confirmrequirements: true }
      : !enteredPassword && enteredPassword
        ? { matchrequirements: true }
        : null;
  }
  getErrorcheckconfirmPassword() {
    return this.registerForm.get('confirmPassword')?.hasError('required')
      ? 'This field is required (Password must contain a minimum of 6 characters (upper or lower case) and at least one number)'
      : this.registerForm
            .get('confirmPassword')
            ?.hasError('Confirmrequirements')
        ? '(Password must contain a minimum of 6 characters (upper or lower case) and at least one number)'
        : this.registerForm.get('confirmPassword')?.hasError('notSame')
          ? ' confirmPassword Does not match'
          : '';
  }

  getErrorsecretKey() {
    return this.registerForm.get('secretKey')?.hasError('required')
      ? 'Secret key should be of 6 characters length and consist of minimum one upper case and minimum one digit, and combination should include only A-Z upper case and 0-9 numbers. please enter valid secret key'
      : this.registerForm.get('secretKey')?.hasError('keyrequirements')
        ? 'Secret key should be of 6 characters length and consist of minimum one upper case and minimum one digit, and combination should include only A-Z upper case and 0-9 numbers. please enter valid secret key'
        : '';
  }
  checkValidation(input: string) {
    const validation =
      this.registerForm.get(input)?.invalid &&
      (this.registerForm.get(input)?.dirty ||
        this.registerForm.get(input)?.touched);
    return validation;
  }

  private handleJwtAuthentication(accessToken: string): any {
    if (!accessToken) {
      this.toastrService.info('Message Failure!', 'check your credentials !!');
      this.router.navigate(['/login']);
      return null;
    }

    const jwtObj = decodeJwtToken(accessToken);
    storeUserSession(accessToken);

    return jwtObj;
  }

  private handleUserLogin(loginCredentials: any, isApiUser = false): void {
    this.authService.login('auth/login', loginCredentials).subscribe({
      next: (data) => {
        const jwtObj = this.handleJwtAuthentication(data['accessToken']);
        if (!jwtObj) return;
        this.router.navigate(['/dashboard']);
        if (isApiUser) {
          this.handleApiUserLogin();
          return;
        }
        this.toastrService.success(
          `login user ${jwtObj.email}!`,
          'login Success',
        );
      },
      error: (error) => {
        console.error('Login error:', error);
        this.toastrService.error(
          `Error: ${error.error?.message || 'Unknown error'}, Check your credentials!`,
          'Login Failed!',
        );
      },
    });
  }

  private handleApiUserLogin(): void {
    this.userService.userProfile().subscribe({
      next: (userData: any) => {
        sessionStorage.setItem('apiuserId', userData.api_user_id);
        sessionStorage.setItem('status', userData.status);
        this.router.navigate(['/apiuser/permission/request/form']);
      },
      error: (err) => {
        this.toastrService.error('Error!', err.error.message);
      },
    });
  }

  private handleApiUserRegistration(data: any, loginCredentials: any): void {
    this.response = data;
    this.showPopup = true;
    this.toastrService.success('User Register Successful');

    this.authService
      .ApiUserExportAccesskey(
        'user/export-accesskey/',
        this.response.api_user_id,
      )
      .subscribe({
        next: (keydata) => {
          this.downloadAccessKey(keydata);
          setTimeout(() => this.handleUserLogin(loginCredentials), 1000);
        },
      });
  }

  private downloadAccessKey(keydata: any): void {
    const blob = new Blob([keydata], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${this.response.api_user_id}.pem`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    this.showPopup = false;
  }

  onSubmit(): void {
    const formValues = { ...this.registerForm.value };

    if (formValues.phoneNumber) {
      formValues.phoneNumber = formValues.phoneNumber.replace(/\s+/g, '');
    }

    const loginCredentials = {
      username: formValues.email,
      password: formValues.password,
    };

    this.authService.PostAuth('user/register', formValues).subscribe({
      next: (data) => {
        if (formValues.organizationType === 'ApiUser') {
          this.handleApiUserRegistration(data, loginCredentials);
          return;
        }
        this.handleUserLogin(loginCredentials);
        this.registerForm.reset();
      },
      error: (err) => {
        console.error('Registration error:', err);
        this.toastrService.error(
          err.error?.message || 'Registration failed',
          'Error!',
        );
      },
    });
  }
}
