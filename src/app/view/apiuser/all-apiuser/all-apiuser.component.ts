import { FormBuilder, FormGroup } from '@angular/forms';
import { Component, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AuthbaseService } from '../../../auth/authbase.service';
import { AdminService, OrganizationService } from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../confirm-dialog/confirm-dialog.component';
import { EditUserComponent } from '../../edit-user/edit-user.component';
import { ToastrService } from 'ngx-toastr';
import { InvitationformComponent } from '../../admin/invitationform/invitationform.component';
@Component({
  selector: 'app-all-apiuser',
  templateUrl: './all-apiuser.component.html',
  styleUrls: ['./all-apiuser.component.scss'],
})
export class AllApiuserComponent {
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
  showorg: boolean = false;
  orgdetails: any;
  loginuser: any;
  orglist: any;
  showorguser: boolean = true;
  filteredOptions: Observable<any[]>;
  subscription: Subscription;
  showerror: boolean = false;
  apiuserId: string;
  constructor(
    private authService: AuthbaseService,
    private orgService: OrganizationService,
    private adminService: AdminService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute,
    private toastrService: ToastrService,
  ) {
    this.apiuserId = sessionStorage.getItem('apiuserId')!;
    if (this.activatedRoute.snapshot.params['id']) {
      this.orgnaizatioId = this.activatedRoute.snapshot.params['id'];
      this.showorg = true;
      this.adminService
        .GetOrganizationById(this.orgnaizatioId)
        .subscribe((data) => {
          this.orgdetails = data;
        });
    }
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }
  ngOnInit(): void {
    this.FilterForm = this.formBuilder.group({
      organizationName: [],
    });
    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org: { organizationType: string; api_user_id: string }) =>
            org.organizationType == 'ApiUser' &&
            org.api_user_id != this.apiuserId,
        );
      });
    }

    setTimeout(() => {
      // if (this.countrycodeLoded) {
      this.applyorgFilter();
      // }
      this.loading = false;
      this.getAllUsers(this.p);
    }, 2000);
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  applyorgFilter() {
    this.FilterForm.controls['organizationName'];
    this.filteredOptions = this.FilterForm.controls[
      'organizationName'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '')),
    );
  }

  private _filter(value: any): string[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.orglist.filter((option: any) =>
          option.name.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showerror = true;
    } else {
      this.showerror = false;
    }
    return this.orglist.filter(
      (option: any) =>
        option.name.toLowerCase().indexOf(filterValue.toLowerCase()) === 0,
    );
  }

  selectOrg(event: any) {
    this.subscription = this.filteredOptions.subscribe((options) => {
      const selectedorg = options.find(
        (option) => option.name === event.option.value,
      );
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
  getAllUsers(page: number) {
    const limit = 20;
    if (this.loginuser.role === 'Admin') {
      this.adminService
        .GetAllApiUsers(page, limit, this.FilterForm.value)
        .subscribe((data) => {
          this.showlist = true;
          this.showorguser = false;
          this.loading = false;
          this.data = data; //.filter(ele => ele.organizationType === 'Developer');
          this.dataSource = new MatTableDataSource(this.data.users);
          this.totalRows = this.data.totalCount;
          this.totalPages = this.data.totalPages;
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
      this.getAllUsers(this.p);
    }
  }
  openUpdateDialog(user: any) {
    //this.router.navigate(['/admin/edit_user/' + user.id]);
    const confirmDialog = this.dialog.open(EditUserComponent, {
      data: {
        title: 'Edit User',
        //message: 'Are you sure, you want to remove Uaer: ' + user.firstName+ '' +user.lastName
        userinfo: user,
      },
      width: '900px',
      height: '300px',
    });
    confirmDialog.afterClosed().subscribe((result) => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        this.getAllUsers(this.p);
      }
    });
  }

  openDialog(user: any) {
    if (user.role === 'OrganizationAdmin' || user.role === 'Buyer') {
      const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Confirm Remove User',
          message:
            'Are you sure, you want to remove User: ' +
            user.firstName +
            '' +
            user.lastName +
            ', if yes please assign this role to other user of this organization',
          data: user,
          showchangeform: true,
        },
      });
      confirmDialog.afterClosed().subscribe((result) => {
        if (result === true) {
          // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
          this.deleteUser(user.id);
        }
      });
    } else {
      const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Confirm Remove User',
          message:
            'Are you sure, you want to remove User: ' +
            user.firstName +
            '' +
            user.lastName,
        },
      });
      confirmDialog.afterClosed().subscribe((result) => {
        if (result === true) {
          // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
          this.deleteUser(user.id);
        }
      });
    }
  }
  deleteUser(id: number) {
    this.adminService.removeUser(id).subscribe(
      (response) => {
        if (response.success) {
          this.toastrService.success('User Deleted', 'Successful');
          this.getAllUsers(this.p);
        } else {
          this.toastrService.error(response.message, 'Failure');
        }
      },
      (err) => {
        this.toastrService.error(err.error.message, 'Failure');
      },
    );
  }

  openinviteDialog() {
    const confirmDialog = this.dialog.open(InvitationformComponent, {
      data: {
        title: 'User invite in ' + this.orgdetails.name,
        message: 'Are you sure, you want to  Invite: ',
        orginfo: this.orgdetails,
      },
    });
    confirmDialog.afterClosed().subscribe((result) => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        //this.deleteDevice(device.id)
        this.getAllUsers(this.p);
      }
    });
  }
}
