import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router } from '@angular/router';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { ToastrService } from 'ngx-toastr';
import { UserService } from '../../auth/services';
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
    { value: 'ApiUser', viewValue: 'ApiUser' },
  ];
  hide = true;
  hide1 = true;
  matchconfirm: boolean = false;
  showPopup: boolean = false;
  emailregex: RegExp =
    // eslint-disable-next-line no-useless-escape
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
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
          Validators.pattern(this.emailregex),
        ]),
        password: new FormControl(null, [
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
  checkconfirmPassword(control: any) {
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

  // checksecretKey(control: any) {
  //   let enteredsecretKey = control.value
  //   let secretKeyCheck = /^(?=.*\d)(?=.*[A-Z])[A-Z0-9]{6}$/;
  //   return (!secretKeyCheck.test(enteredsecretKey) && enteredsecretKey) ? { 'keyrequirements': true } : null;
  // }
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
  padBase64(token: any) {
    const base64 = token.replace('-', '+').replace('_', '/');
    return base64;
  }
  b64DecodeUnicode(token: any) {
    const base64Payload = window.atob(token);
    return base64Payload;
  }
  response: any;
  onSubmit(): void {
    this.authService
      .PostAuth('user/register', this.registerForm.value)
      .subscribe({
        next: (data) => {
          const loginobj = {
            username: this.registerForm.value.email,
            password: this.registerForm.value.password,
          };
          if (this.registerForm.value.organizationType === 'ApiUser') {
            this.response = data;
            this.toastrService.success('User Register Successfull');
            this.showPopup = true;
            this.authService
              .ApiUserExportAccesskey(
                'user/export-accesskey/',
                this.response.api_user_id,
              )
              .subscribe({
                next: (keydata) => {
                  setTimeout(() => {
                    this.showkeypopup(keydata, loginobj);
                  }, 1000);
                },
              });
          } else {
            this.authService.login('auth/login', loginobj).subscribe({
              next: (data) => {
                if (data['accessToken'] != null) {
                  sessionStorage.setItem('access-token', data['accessToken']);
                  const jwtObj = JSON.parse(
                    this.b64DecodeUnicode(
                      this.padBase64(data['accessToken'].split('.')[1]),
                    ),
                  );
                  //sessionStorage.setItem('loginuser', jwtObj);
                  sessionStorage.setItem('loginuser', JSON.stringify(jwtObj));
                  //var obj = JSON.parse(sessionStorage.loginuser);

                  if (jwtObj.role === 'Buyer') {
                    this.router.navigate(['/myreservation']);
                  } else {
                    this.router.navigate(['/device/AllList']);
                  }
                  this.toastrService.success(
                    'login user ' + jwtObj.email + '!',
                    'login Success',
                  );
                } else {
                  this.toastrService.info(
                    'Message Failure!',
                    'check your credentials !!',
                  );
                  this.router.navigate(['/login']);
                }
              },
              error: (err) => {
                //Error callback
                console.error('error caught in component', err);
                this.toastrService.error(
                  'check your credentials!',
                  'login Fail!!',
                );
              },
            });
            this.registerForm.reset();
            const formControls = this.registerForm.controls;

            Object.keys(formControls).forEach((key) => {
              const control = formControls[key];
              control.setErrors(null);
            });
            // this.router.navigate(['/confirm-email']);
          }
        },
        error: (err) => {
          //Error callback
          console.error('error caught in component', err);
          this.toastrService.error('error!', err.error.message);
        },
      });
  }
  showkeypopup(ketdata: any, logininfo: any) {
    setTimeout(() => {
      const blob = new Blob([ketdata], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.response.api_user_id}.pem`; // Replace with the desired file name
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url); //
      // this.toastrService.success('Access Key downloaded successfully' ,'Please keep it confidential');
      this.showPopup = false;
      this.loginapiuser(logininfo);
    }, 5000);
  }
  loginapiuser(logininfo: any) {
    this.authService.login('auth/login', logininfo).subscribe({
      next: (data: any) => {
        if (data['accessToken'] != null) {
          sessionStorage.setItem('access-token', data['accessToken']);
          const jwtObj = JSON.parse(
            this.b64DecodeUnicode(
              this.padBase64(data['accessToken'].split('.')[1]),
            ),
          );
          sessionStorage.setItem('loginuser', JSON.stringify(jwtObj));
          this.userService.userProfile().subscribe({
            next: (data1: any) => {
              sessionStorage.setItem('apiuserId', data1.api_user_id);
              sessionStorage.setItem('status', data1.status);
              this.router.navigate(['/apiuser/permission/request/form']);
            },
            error: (err: any) => {
              this.toastrService.error('Error!', err.error.message);
            },
          });
        } else {
          this.toastrService.info(
            'Message Failure!',
            'Check your credentials !!',
          );
          this.router.navigate(['/login']);
        }
      },
      error: (error) => {
        //Error callback
        console.error('error caught in component', error);
        this.toastrService.error(
          'Error:' + error.error.message + ',Check your credentials!',
          'Login Fail!!',
        );
      },
    });
  }
}
