import { Component, Inject, ViewChild, ElementRef } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { AdminService, UserService, InvitationService, OrganizationService } from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { MatTabGroup } from '@angular/material/tabs';
@Component({
  selector: 'app-user-invitation',
  templateUrl: './user-invitation.component.html',
  styleUrls: ['./user-invitation.component.scss']
})
export class UserInvitationComponent {
  @ViewChild(MatPaginator)
  paginator!: MatPaginator;

  displayedColumns: string[] = ['sender', 'email', 'status', 'Action'];//... set columns here
  @ViewChild(MatTabGroup) tabGroup: MatTabGroup;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  dataSource1: MatTableDataSource<any>;
  readdata: any;
  inviteForm: FormGroup;
  invitaionlist: any;
  userstatus: any;
  orginviteuser: any;
  showorginviteuser: boolean = false;
  loading: boolean = false;
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
  constructor(private fb: FormBuilder,
    private adminService: AdminService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    private userService: UserService,
    private orgService: OrganizationService,
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
    console.log(this.userstatus)
    console.log(this.userstatus !='Pending')
    setTimeout(() => {
      if (this.userstatus=== 'Active' && this.loginuser.role=== 'OrganizationAdmin') {
        console.log(this.userstatus)
        this.displayedColumns = ['sender', 'email', 'status']
        this.getorginviteuserlist();
      }else{
        this.getinvitationList();
      }
    }, 1000);
   

   
  }
  onSubmit() {
    this.inveiteService.Postuserinvitation(this.inviteForm.value).subscribe({
      next: response => {
        console.log(response);
        this.inviteForm.reset();
        this.loading=true;
        if (response.success) {
          this.loading=false;
          this.tabGroup.selectedIndex = 1;
          this.toastrService.success('Invitation Sent')
          this.displayedColumns = ['sender', 'email', 'status']
          this.getorginviteuserlist();
        }
      }, error: err => {
        this.toastrService.error('Fail', err.error.message)
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

  getorginviteuserlist() {
    this.orgService.getOrganizationInformation().subscribe((data) => {
      console.log('org', data);
      //@ts-ignore
      this.orginviteuser = data.invitations
      this.dataSource1=new MatTableDataSource(this.orginviteuser);

      this.showorginviteuser = true;
    })
  }
}
