import { Component, Inject, ViewChild } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { AdminService, UserService, InvitationService } from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource, MatTable } from '@angular/material/table';
@Component({
  selector: 'app-user-invitation',
  templateUrl: './user-invitation.component.html',
  styleUrls: ['./user-invitation.component.scss']
})
export class UserInvitationComponent {
  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  displayedColumns: string[] = ['sender', 'email', 'status', 'Action'];//... set columns here

  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  readdata: any;
  inviteForm: FormGroup;
  invitaionlist: any;
  userstatus: any;
  emailregex: RegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  orgtype: any[] = [
    { value: 'Developer', viewValue: 'Developer' },
    { value: 'DeviceOwner', viewValue: 'DeviceOwner' },
    { value: 'User', viewValue: 'User' }
  ];
  orgtypebuyer: any[] = [

    { value: 'Buyer', viewValue: 'Buyer' },

    { value: 'User', viewValue: 'User' }
  ];
  loginuser: any;
  constructor(private fb: FormBuilder,
    private adminService: AdminService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    private userService: UserService,
    private inveiteService: InvitationService,) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.userstatus = sessionStorage.getItem('status')
    console.log(this.userstatus)

  }

  ngOnInit() {

    this.inviteForm = this.fb.group({
      firstName: [null],
      lastName: [null],
      email: [null, [Validators.required, Validators.pattern(this.emailregex)]],
      role: [null, [Validators.required]],
    });
    if (this.userstatus = !'Pending') {
      this.displayedColumns = ['sender', 'email', 'status']
    }
    this.getinvitationList();
  }
  onSubmit() {
    this.inveiteService.Postuserinvitation(this.inviteForm.value).subscribe({
      next: response => {
        console.log(response);
        if (response.success) {
          this.toastrService.success('Invitation Sent')

        }
      }, error: err => {
        this.toastrService.success('Fail',err.message)
      }
    })

  }

  getinvitationList() {
    this.inveiteService.getinvitaion().subscribe({
      next: data => {
        this.invitaionlist = data;
        this.dataSource = new MatTableDataSource(this.invitaionlist);

      }, error: err => {

      }
    })
  }
}
