import { Component, Inject } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { AdminService, UserService } from '../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UserStatus } from '../../utils/drec.enum'
@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent {
  updateForm: FormGroup;
  userinfo: any;
  userid: number;
  firstName: string = "";
  lastName: string = "";
  email: string = "";
  userstatus: any = UserStatus;
  loginuser: any;
  status: any;
  emailregex: RegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  fieldRequired: string = "This field is required"
  resetpasswordform: FormGroup
  hide = true;
  hide1 = true;
  matchconfirm: boolean = false;
  usertoken:any;
  constructor(private fb: FormBuilder,
    private adminService: AdminService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    private userService: UserService
  ) {
    // this.usertoken = sessionStorage.getItem('access-token');
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    //this.userid = this.activatedRoute.snapshot.params['id'];
    this.userService.userProfile().subscribe((data) => {
      this.userinfo = data

      this.firstName = this.userinfo.firstName
      this.lastName = this.userinfo.lastName
      this.email = this.userinfo.email
  // this.status = this, this.userinfo.status
    });
    console.log(this.userinfo)

  }
  ngOnInit() {
    console.log(this.userinfo)
    console.log(this.userstatus);
    this.updateForm = this.fb.group({
      firstName: [null, Validators.required],
      lastName: [null],
      email: [null, [Validators.required, Validators.pattern(this.emailregex)]],
      status: [null],
    });
    this.resetpasswordform = new FormGroup(
      {
        newPassword: new FormControl('', [Validators.required, this.checkPassword]),
        confirmPassword: new FormControl('', [Validators.required, this.checkconfirmPassword]),

      },
      {
        validators: (control) => {

          if (control.value.newPassword !== control.value.confirmPassword) {
            //@ts-ignore
            control.get("confirmPassword").setErrors({ notSame: true });
          }
          return null;
        },
      }
    );
    this.resetpasswordform.reset();
  }
  emaiErrors() {
    return this.updateForm.get('email')?.hasError('required') ? 'This field is required' :
      this.updateForm.get('email')?.hasError('pattern') ? 'Not a valid emailaddress' : ''

  }
  checkPassword(control: any) {
    let enteredPassword = control.value
    let passwordCheck = /((?=.*[0-9])(?=.*[A-Za-z]).{6,})/;
    return (!passwordCheck.test(enteredPassword) && enteredPassword) ? { 'requirements': true } : null;
  }
  getErrorPassword() {
    return this.resetpasswordform.get('newPassword')?.hasError('required') ? 'This field is required (Password must contain minimum 6 characters (upper and/or lower case) and at least one number)' :
      this.resetpasswordform.get('newPassword')?.hasError('requirements') ? '(Password must contain minimum 6 characters (upper and/or lower case) and at least one number)' : '';
  }
  checkconfirmPassword(control: any) {
    // console.log(this.resetpasswordform.value)

    let enteredPassword = control.value;;
    let passwordCheck = /((?=.*[0-9])(?=.*[A-Za-z]).{6,})/;
    // console.log(this.resetpasswordform.value.password);
    //this.resetpasswordform.value.password = this.resetpasswordform.value.password?:'';
    return (!passwordCheck.test(enteredPassword) && enteredPassword) ? { 'Confirmrequirements': true } :
      (!enteredPassword && enteredPassword) ? { 'matchrequirements': true } : null;
  }
  getErrorcheckconfirmPassword() {
    return this.resetpasswordform.get('confirmPassword')?.hasError('required') ? 'This field is required (Password must contain minimum 6 characters (upper and/or lower case) and at least one number)' :
      this.resetpasswordform.get('confirmPassword')?.hasError('Confirmrequirements') ? '(Password must contain minimum 6 characters (upper and/or lower case) and at least one number)' :
        this.resetpasswordform.get('confirmPassword')?.hasError('notSame') ? ' confirmPassword Does not match' : '';
  }
  checkValidation(input: string) {
    const validation = this.resetpasswordform.get(input)?.invalid && (this.resetpasswordform.get(input)?.dirty || this.resetpasswordform.get(input)?.touched)
    return validation;
  }
  onUpdate() {

    this.userService.updatProfile(this.updateForm.value).subscribe((data) => {
      console.log(data);

      this.toastrService.success("User Updated", "Successful")
      // this.dialogRef.close;

    })

  }
  onResetPasswordUpdate() {

    this.userService.resetPassword(this.loginuser.email,this.resetpasswordform.value).subscribe((data) => {
      console.log(data);

      this.toastrService.success("Password Updated", "Successfully")
      // this.dialogRef.close;

    })

  }
}
