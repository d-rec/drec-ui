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

  displayedColumns: string[] = ['sender', 'email', 'status'];//... set columns here
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
  filteredOrgList: any[] = [];
  //public color: ThemePalette = 'primary';
  orgname: string;
  orgId: number;
  orglist: any;
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
  
  }

  ngOnInit() {
    if (this.loginuser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe(
        (data) => {
          //@ts-ignore
          this.orglist = data.organizations.filter(org => org.organizationType != "Buyer");
        
          // const buyerOrganizations = data.filter(org => org.organizationType === "Buyer");
          this.filteredOrgList = this.orglist;
          // Once data is loaded, call any other functions that depend on it


        }
      );
    }
    this.inviteForm = this.fb.group({
      firstName: [null],
      lastName: [null],
      email: [null, [Validators.required, Validators.pattern(this.emailregex)]],
      role: [null, [Validators.required]],
    });
   
  
    setTimeout(() => {
      
      this.getorginviteuserlist();
    }, 1000);



  }
  filterOrgList() {
    this.filteredOrgList = this.orglist.filter((org: any) => {
      return org.name.toLowerCase().includes(this.orgname.toLowerCase());
    });
  }
  selectOrg(event: any) {
    //@ts-ignore
    const selectedCountry = this.orglist.find(option => option.name === event.option.value);
    if (selectedCountry) {
      this.orgId = selectedCountry.id;
    }
  }
  onSubmit() {
    this.inveiteService.Postuserinvitation(this.inviteForm.value).subscribe({
      next: response => {
      
        this.inviteForm.reset();
        this.loading = true;
        if (response.success) {
          this.loading = false;
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
   
      //@ts-ignore
      this.orginviteuser = data.invitations
      this.dataSource1 = new MatTableDataSource(this.orginviteuser);

      this.showorginviteuser = true;
    })
  }
}
