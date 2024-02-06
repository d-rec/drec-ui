import { Component, Inject, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { AdminService, UserService, InvitationService } from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { getapiuser_header } from '../../../utils/apiuser_clientinfo'

@Component({
  selector: 'app-invitationform',
  templateUrl: './invitationform.component.html',
  styleUrls: ['./invitationform.component.scss']
})
export class InvitationformComponent {
  title: string;
  message: string;
  inviteForm: FormGroup;
  invitaionlist: any;

  emailregex: RegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  orgtype: any[] = [
    // { value: 'OrganizationAdmin', viewValue: 'Developer' },
    { value: 'DeviceOwner', viewValue: 'DeviceOwner' },
    { value: 'User', viewValue: 'User' }
  ];
  orgtypebuyer: any[] = [

    { value: 'SubBuyer', viewValue: 'SubBuyer' },

    { value: 'User', viewValue: 'User' }
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
    @Inject(MAT_DIALOG_DATA) public data: any) {
    this.data = data.orginfo;
    console.log("hgfyt", this.data)
    if (data.orginfo.organizationType === 'Developer') {
      this.role = 'OrganizationAdmin';
    }
    if (data.orginfo.organizationType === 'Buyer') {
      this.role = 'Buyer';
    }


  }
  ngOnInit() {
    console.log(this.data)
    // console.log(this.userstatus);
    // this.getinvitationList();
    this.inviteForm = this.fb.group({
      firstName: [null],
      lastName: [null],
      email: [null, [Validators.required, Validators.pattern(this.emailregex)]],
      role: [null, [Validators.required]],
    });

  }
  emaiErrors() {
    return this.inviteForm.get('email')?.hasError('required') ? 'This field is required' :
      this.inviteForm.get('email')?.hasError('pattern') ? 'Not a valid emailaddress' : ''

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
    console.log("invite")

    const headers = getapiuser_header();
    console.log(headers)
    setTimeout(() => {
      this.inveiteService.Postuserinvitation(this.inviteForm.value, this.data.id, headers).subscribe({
        next: (response) => {
          console.log(response);
          if (response.success) {
            this.toastrService.success('Invitation Sent')
            this.dialogRef.close(true)
          }
        }, error: err => {
          this.toastrService.error('Error:' + err.error.message, 'Invitation Fail')
        }
      });
    }, 2000)
  }
  getinvitationList() {
    this.inveiteService.getinvitaion().subscribe({
      next: data => {
        this.invitaionlist = data;

      }, error: err => {

      }
    })
  }
}
