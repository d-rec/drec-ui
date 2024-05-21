import { Component, OnInit } from '@angular/core';
import {
  FormGroup,
  FormControl,
  FormBuilder,
  Validators,
  FormGroupDirective,
} from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { Router } from '@angular/router';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';
import { UserService } from '../../../auth/services';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-add-users',
  templateUrl: './add-users.component.html',
  styleUrls: ['./add-users.component.scss'],
  providers: [
    {
      provide: STEPPER_GLOBAL_OPTIONS,
      useValue: { showError: true },
    },
  ],
})
export class AddUsersComponent {
  registerForm: FormGroup;
  fieldRequired: string = 'This field is required';
  orgtype: any[] = [
    { value: 'Developer', viewValue: 'Developer' },
    { value: 'Buyer', viewValue: 'Buyer' },
  ];
  hide = true;
  hide1 = true;
  matchconfirm: boolean = false;
  loginuser: any;
  apiuserId: string;
  emailregex: RegExp =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  constructor(
    private authService: AuthbaseService,
    private _formBuilder: FormBuilder,
    private toastrService: ToastrService,
    private userService: UserService,
    private router: Router,
  ) {
    // this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.apiuserId = sessionStorage.getItem('apiuserId')!;
    this.createForm();
  }
  createForm() {
    this.registerForm = new FormGroup({
      firstName: new FormControl(null, [Validators.required]),
      lastName: new FormControl(null, [Validators.required]),
      orgName: new FormControl(null, [Validators.required]),
      organizationType: new FormControl(null),
      orgAddress: new FormControl(null),
      email: new FormControl(null, [
        Validators.required,
        Validators.pattern(this.emailregex),
      ]),
      password: new FormControl(null),
      confirmPassword: new FormControl(null),
    });
  }
  emaiErrors() {
    return this.registerForm.get('email')?.hasError('required')
      ? 'This field is required'
      : this.registerForm.get('email')?.hasError('pattern')
        ? 'Not a valid emailaddress'
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
  onSubmit(formData: FormGroup): void {
    var randPassword = Array(10)
      .fill('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz')
      .map(function (x) {
        return x[Math.floor(Math.random() * x.length)];
      })
      .join('');

    this.registerForm.controls['password'].setValue(randPassword + '1');
    this.registerForm.controls['confirmPassword'].setValue(randPassword + '1');
    if (this.loginuser.role === 'ApiUser') {
      this.userService
        .userregisterByApiUser(this.registerForm.value, this.apiuserId)
        .subscribe({
          next: (data) => {
            this.toastrService.success('Successful!!', 'Registration ');
            this.registerForm.reset();
            const formControls = this.registerForm.controls;

            Object.keys(formControls).forEach((key) => {
              const control = formControls[key];
              control.setErrors(null);
            });
            this.router.navigate(['/apiuser/All_users']);
            // this.router.navigate(['/confirm-email']);
          },
          error: (err) => {
            //Error callback
            console.error('error caught in component', err.error.message);
            this.toastrService.error('error!', err.error.message);
          },
        });
    } else {
      this.authService
        .PostAuth('admin/users', this.registerForm.value)
        .subscribe({
          next: (data) => {
            this.toastrService.success('Successful!!', 'Registration ');
            const loginobj = {
              username: this.registerForm.value.email,
              password: this.registerForm.value.password,
            };

            this.registerForm.reset();
            const formControls = this.registerForm.controls;

            Object.keys(formControls).forEach((key) => {
              const control = formControls[key];
              control.setErrors(null);
            });

            this.router.navigate(['/admin/All_users']);
            // this.router.navigate(['/confirm-email']);
          },
          error: (err) => {
            //Error callback
            console.error('error caught in component', err);
            this.toastrService.error('error!', err.error.message);
          },
        });
    }

    // formDirective.resetForm();
  }
}
