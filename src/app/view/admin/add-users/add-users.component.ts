import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, FormBuilder, Validators, FormGroupDirective, } from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { Router } from '@angular/router';
import { STEPPER_GLOBAL_OPTIONS } from '@angular/cdk/stepper';

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
  fieldRequired: string = "This field is required"
  orgtype: any[] = [
    { value: 'Developer', viewValue: 'Developer' },
    { value: 'Buyer', viewValue: 'Buyer' }
  ];
  hide = true;
  hide1 = true;
  matchconfirm: boolean = false;

  emailregex: RegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  constructor(private authService: AuthbaseService, private _formBuilder: FormBuilder,
    private toastrService: ToastrService, private router: Router,) {
     // this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }


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
        email: new FormControl(null, [Validators.required, Validators.pattern(this.emailregex)]),
        password: new FormControl(null),
       confirmPassword: new FormControl(null),

      },
      // {
      //   validators: (control) => {

      //     if (control.value.password !== control.value.confirmPassword) {
      //       //@ts-ignore
      //       control.get("confirmPassword").setErrors({ notSame: true });
      //     }
      //     return null;
      //   },
      // }
    );


  }
  emaiErrors() {
    return this.registerForm.get('email')?.hasError('required') ? 'This field is required' :
      this.registerForm.get('email')?.hasError('pattern') ? 'Not a valid emailaddress' : ''

  }
 
  checkValidation(input: string) {
    const validation = this.registerForm.get(input)?.invalid && (this.registerForm.get(input)?.dirty || this.registerForm.get(input)?.touched)
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
    console.log(this.registerForm.value)
    // const email = formData.value.email;
    // const password = formData.value.password;
    // const username = formData.value.username;
    //this.auth.post(email, password, username);
    var randPassword = Array(10).fill("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz").map(function (x) { return x[Math.floor(Math.random() * x.length)] }).join('');
    
    this.registerForm.controls['password'].setValue(randPassword);
    this.registerForm.controls['confirmPassword'].setValue(randPassword);
   
    this.authService.PostAuth('admin/users', this.registerForm.value).subscribe({
      next: data => {
        console.log(data)

        this.toastrService.success('Successful!!', 'Registration ');
        const loginobj = {
          username: this.registerForm.value.email,
          password: this.registerForm.value.password
        }
     
        this.registerForm.reset();
        const formControls = this.registerForm.controls;

        Object.keys(formControls).forEach(key => {
          const control = formControls[key];
          control.setErrors(null);
        });

        this.router.navigate(['/admin/All_users']);
        // this.router.navigate(['/confirm-email']);

      },
      error: err => {                          //Error callback
        console.error('error caught in component', err)
        this.toastrService.error('error!', err.error.message);
      }
    });
    // formDirective.resetForm();

  }
}
