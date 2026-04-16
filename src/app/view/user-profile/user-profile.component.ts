import { Component } from '@angular/core';
import { FormGroup, FormBuilder, Validators } from '@angular/forms';
import { AdminService, UserService, OrganizationService } from '../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MatDialog } from '@angular/material/dialog';
import { UserStatus } from '../../utils/drec.enum';
import { PasswordResetDialogComponent } from './password-reset-dialog.component';
@Component({
  standalone: false,
  selector: 'app-user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss'],
})
export class UserProfileComponent {
  updateForm: FormGroup;
  userinfo: any;
  userid: number;
  firstName: string = '';
  lastName: string = '';
  email: string = '';
  userstatus: any = UserStatus;
  loginuser: any;
  status: any;
  emailregex: RegExp =
    // eslint-disable-next-line no-useless-escape
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  fieldRequired: string = 'This field is required';
  usertoken: any;
  orgName = '';
  orgType = '';
  orgStatus = '';

  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    private userService: UserService,
    private orgService: OrganizationService,
    private dialog: MatDialog,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.userService.userProfile().subscribe((data) => {
      this.userinfo = data;
      this.firstName = this.userinfo.firstName;
      this.lastName = this.userinfo.lastName;
      this.email = this.userinfo.email;
    });
    this.orgService.getOrganizationInformation().subscribe((data: any) => {
      this.orgName = data.name;
      this.orgType = data.organizationType;
      this.orgStatus = data.status;
    });
  }
  ngOnInit() {
    this.updateForm = this.fb.group({
      firstName: [null, Validators.required],
      lastName: [null, Validators.required],
      email: [null, [Validators.required, Validators.pattern(this.emailregex)]],
      status: ['Active'],
    });
  }
  emaiErrors() {
    return this.updateForm.get('email')?.hasError('required')
      ? 'This field is required'
      : this.updateForm.get('email')?.hasError('pattern')
        ? 'Not a valid emailaddress'
        : '';
  }
  onUpdate() {
    const updateData = { ...this.updateForm.value };
    delete updateData.email;
    this.userService.updateProfile(updateData).subscribe({
      next: (data) => {
        this.toastrService.success(
          data.firstName + ' User Updated',
          'Successful',
        );
      },
      error: (err) => {
        this.updateForm.reset();
        this.updateForm.patchValue(this.userinfo);
        this.toastrService.error(err.error.message, 'Error');
      },
    });
  }

  openPasswordDialog() {
    this.dialog.open(PasswordResetDialogComponent, {
      width: '480px',
      disableClose: true,
    });
  }

  onDeleteAccount() {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete your account?\n\n' +
      'This action cannot be undone. All your data will be lost.',
    );
    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      'This is your last chance. Type-check: do you really want to delete your account?',
    );
    if (!doubleConfirmed) return;

    this.userService.deleteAccount().subscribe({
      next: () => {
        this.toastrService.success('Account deleted successfully.', 'Goodbye');
        sessionStorage.clear();
        this.router.navigate(['/login']);
      },
      error: (err) => {
        this.toastrService.error(
          err.error?.message || 'Failed to delete account',
          'Error',
        );
      },
    });
  }
}
