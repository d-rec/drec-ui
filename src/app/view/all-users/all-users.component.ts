import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MediaMatcher } from '@angular/cdk/layout';
import { Component, OnInit, ViewChild, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
// import { NavItem } from './nav-item';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuthbaseService } from '../../auth/authbase.service';
import { AdminService, OrganizationService } from '../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component'
import { EditUserComponent } from '../edit-user/edit-user.component';
import { ToastrService } from 'ngx-toastr';
import { errors } from 'ethers';
import { InvitationformComponent } from '../admin/invitationform/invitationform.component'
@Component({
  selector: 'app-all-users',
  templateUrl: './all-users.component.html',
  styleUrls: ['./all-users.component.scss']
})
export class AllUsersComponent {
  FilterForm: FormGroup;
  displayedColumns = [
    'organization',
    'name',
    'email',
    'type',
    'status',
    'actions',
  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  data: any;
  showlist: boolean = false;
  loading: boolean = true;
  totalRows: number;
  totalPages: number = 1;
  p: number = 1;
  orgnaizatioId: number;
  showorg: boolean = false
  orgdetails: any
  loginuser: any;
  orglist: any;
  showorguser: boolean = true;
  filteredOptions: Observable<any[]>;
  subscription: Subscription;
  showerror: boolean = false;
  constructor(private authService: AuthbaseService,
    private orgService: OrganizationService,
    private adminService: AdminService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute,
    private toastrService: ToastrService) {
    if (this.activatedRoute.snapshot.params['id']) {
      this.orgnaizatioId = this.activatedRoute.snapshot.params['id'];
      this.showorg = true;
      this.adminService.GetOrganizationById(this.orgnaizatioId).subscribe((data) => {
        console.log('org', data)

        this.orgdetails = data

      })
    }
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }
  ngOnInit(): void {
    this.FilterForm = this.formBuilder.group({
      organizationName: [],

      //pagenumber: [this.p]
    });
    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe(
        (data) => {
          this.orglist = data.organizations
          console.log(this.orglist)
        
          
        })
    }

    setTimeout(() => {
      // if (this.countrycodeLoded) {
        this.applyorgFilter();   
          // }
      this.loading = false;
      this.getAllUsers(this.p);
    }, 2000)
   
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  applyorgFilter() {
    this.FilterForm.controls['organizationName'];
    this.filteredOptions = this.FilterForm.controls['organizationName'].valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || '')),
    );
  }

  private _filter(value: any): string[] {

    const filterValue = value.toLowerCase();
    if (!(this.orglist.filter((option: any) => option.name.toLowerCase().includes(filterValue)).length > 0)) {
      this.showerror = true;
      // const updatedFormValues = this.FilterForm.value;
      // const isAllValuesNull = Object.values(this.FilterForm.value).some((value) => !!value);
      // this.isAnyFieldFilled = false;
    } else {
      this.showerror = false;
    }
    return this.orglist.filter((option: any) => option.name.toLowerCase().indexOf(filterValue.toLowerCase()) === 0);

  }

  selectOrg(event: any) {
    console.log(event)

    this.subscription = this.filteredOptions.subscribe(options => {

      const selectedorg = options.find(option => option.name === event.option.value);
      if (selectedorg) {
        this.FilterForm.controls['organizationName'].setValue(selectedorg.name);
      }
    });
  }
  reset() {
    this.FilterForm.reset();

    this.FilterForm.controls['organizationName'].setValue(null);
    this.loading = true;
    this.applyorgFilter();
    this.getAllUsers(this.p);
  }
  getAllUsers(page:number) {
    const limit=20;
    if (this.loginuser.role === "Admin") {
      if (this.orgnaizatioId != null || this.orgnaizatioId != undefined) {
        this.adminService.GetAllOrgnaizationUsers(this.orgnaizatioId,page,limit).subscribe((data) => {
          console.log(data)
          this.showorguser=false;
          this.showlist = true
          this.loading = false
          //@ts-ignore
          this.data = data;//.filter(ele => ele.organizationType === 'Developer');
          console.log(this.data);
          this.dataSource = new MatTableDataSource(this.data.users);
          this.totalRows = this.data.totalCount
          console.log(this.totalRows);
          this.totalPages = this.data.totalPages
        })
      } else {
        this.adminService.GetAllUsers(page,limit,this.FilterForm.value).subscribe((data) => {
          console.log(data)
          this.showlist = true;
          this.showorguser=false;
          this.loading = false
          //@ts-ignore
          this.data = data;//.filter(ele => ele.organizationType === 'Developer');
          console.log(this.data);
          this.dataSource = new MatTableDataSource(this.data.users);
          this.totalRows = this.data.totalCount
          console.log(this.totalRows);
          this.totalPages = this.data.totalPages
        })
      }

    } else {
      this.showorg=true
      this.orgService.getOrganizationUser(page,limit).subscribe({
        next: (data) => {

          console.log(data)
          this.showlist = true
          this.loading = false
          //@ts-ignore
          this.data = data;//.filter(ele => ele.organizationType === 'Developer');
          console.log(this.data);
          this.dataSource = new MatTableDataSource(this.data.users);
          this.totalRows = this.data.totalCount
          console.log(this.totalRows);
          this.totalPages = this.data.totalPages

        }, error: err => {
          console.log(err)
        }
      });


    }

  }
  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.getAllUsers(this.p);
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.getAllUsers(this.p);;
    }
  }
  openUpdateDialog(user: any) {

    //this.router.navigate(['/admin/edit_user/' + user.id]);
    const confirmDialog = this.dialog.open(EditUserComponent, {
      data: {
        title: 'Edit User',
        //message: 'Are you sure, you want to remove Uaer: ' + user.firstName+ '' +user.lastName
        userinfo: user
      },
      width: '900px',
      height: '300px',
    });
    confirmDialog.afterClosed().subscribe(result => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        this.getAllUsers(this.p)
      }
    });
  }

  openDialog(user: any) {
    console.log(user)
    if (user.role === 'OrganizationAdmin'||user.role === 'Buyer') {
      const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Confirm Remove User',
          message: 'Are you sure, you want to remove User: ' + user.firstName + '' + user.lastName + ', if yes please assign this role to other user of this organization',
          data: user,
          showchangeform: true,
        }
      });
      confirmDialog.afterClosed().subscribe(result => {
        if (result === true) {
          // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
          this.deleteUser(user.id)
        }
      });

    } else {
      const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Confirm Remove User',
          message: 'Are you sure, you want to remove User: ' + user.firstName + '' + user.lastName
        }
      });
      confirmDialog.afterClosed().subscribe(result => {
        if (result === true) {
          // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
          this.deleteUser(user.id)
        }
      });
    }

  }
  deleteUser(id: number) {

    this.adminService.removeUser(id).subscribe((response) => {
      console.log(response);
      if (response.success) {
        this.toastrService.success('User Deleted', 'Successful')
        this.getAllUsers(this.p);
      } else {

        this.toastrService.error(response.message, 'Failure')
      }

    }, (err) => {
      console.log(err)
      this.toastrService.error(err.error.message, 'Failure')
    })


  }

  openinviteDialog() {
    const confirmDialog = this.dialog.open(InvitationformComponent, {
      data: {
        title: 'User invite in ' + this.orgdetails.name,
        message: 'Are you sure, you want to  Invite: ',
        orginfo: this.orgdetails
      }
    });
    confirmDialog.afterClosed().subscribe(result => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        //this.deleteDevice(device.id)
      }
    });
  }
}
