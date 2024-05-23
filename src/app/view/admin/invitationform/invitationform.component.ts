import { Component, Inject } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
} from '@angular/forms';
import {
  AdminService,
  UserService,
  InvitationService,
} from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';

@Component({
  selector: 'app-invitationform',
  templateUrl: './invitationform.component.html',
  styleUrls: ['./invitationform.component.scss'],
})
export class InvitationformComponent {
  title: string;
  message: string;
  inviteForm: FormGroup;
  invitaionlist: any;

  emailregex: RegExp =
  // eslint-disable-next-line no-useless-escape
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  orgtype: any[] = [
    { value: 'DeviceOwner', viewValue: 'DeviceOwner' },
    { value: 'User', viewValue: 'User' },
  ];
  orgtypebuyer: any[] = [
    { value: 'SubBuyer', viewValue: 'SubBuyer' },

    { value: 'User', viewValue: 'User' },
  ];
  loginuser: any;
  role: any;
  constructor(
    private fb: FormBuilder,
    private adminService: AdminService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    private userService: UserService,
    private inveiteService: InvitationService,

    public dialogRef: MatDialogRef<InvitationformComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {
    this.data = data.orginfo;
    if (data.orginfo.organizationType === 'Developer') {
      this.role = 'OrganizationAdmin';
    }
    if (data.orginfo.organizationType === 'Buyer') {
      this.role = 'Buyer';
    }
  }
  ngOnInit() {
    // this.getinvitationList();
    this.inviteForm = this.fb.group({
      firstName: [null],
      lastName: [null],
      email: [null, [Validators.required, Validators.pattern(this.emailregex)]],
      role: [null, [Validators.required]],
    });
  }
  emaiErrors() {
    return this.inviteForm.get('email')?.hasError('required')
      ? 'This field is required'
      : this.inviteForm.get('email')?.hasError('pattern')
        ? 'Not a valid emailaddress'
        : '';
  }
  start() {
    this.inviteForm = this.fb.group({
      firstName: [null],
      lastName: [null],
      email: [null, [Validators.required, Validators.pattern(this.emailregex)]],
      role: [null, [Validators.required]],
    });
  }
  async onSubmit() {
    setTimeout(() => {
      this.inveiteService
        .Postuserinvitation(this.inviteForm.value, this.data.id)
        .subscribe({
          next: (response) => {
            if (response.success) {
              this.toastrService.success('Invitation Sent');
              this.dialogRef.close(true);
            }
          },
          error: (err) => {
            if (err.error.statusCode === 403) {
              this.toastrService.error('You are Unauthorized');
            }
            this.toastrService.error(
              'Error:' + err.error.message,
              'Invitation Fail',
            );
          },
        });
    }, 2000);
  }
  getinvitationList() {
    this.inveiteService.getinvitaion().subscribe({
      next: (data) => {
        this.invitaionlist = data;
      },
      error: (err) => {
        this.toastrService.error("failed",err)
      },
    });
  }
}
