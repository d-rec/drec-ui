import { FormBuilder, FormGroup } from '@angular/forms';
import { Component, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AuthbaseService } from '../../auth/authbase.service';
import { AdminService, OrganizationService } from '../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component';
import { EditUserComponent } from '../edit-user/edit-user.component';
import { ToastrService } from 'ngx-toastr';
import { InvitationformComponent } from '../admin/invitationform/invitationform.component';
import { getRoleName, getOrgTypeName } from '../../utils/role-helper';
@Component({
  standalone: false,
  selector: 'app-all-users',
  templateUrl: './all-users.component.html',
  styleUrls: ['./all-users.component.scss'],
})
export class AllUsersComponent {
  getRoleName = getRoleName;
  getOrgTypeName = getOrgTypeName;
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
  orgnaizatioId: any;
  showorg: boolean = false;
  orgdetails: any;
  loginuser: any;
  orglist: any;
  showorguser: boolean = true;
  filteredOptions: Observable<any[]>;
  subscription: Subscription;
  showerror: boolean = false;
  searchText: string = '';
  allUsers: any[] = [];
  registrantId: string;
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
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.registrantId = sessionStorage.getItem('registrantId')!;
    if (this.activatedRoute.snapshot.params['id']) {
      this.orgnaizatioId = this.activatedRoute.snapshot.params['id'];
      this.showorg = true;
      if (this.loginuser.role === 'Registrant') {
        this.orgService
          .GetOrganizationById(this.orgnaizatioId)
          .subscribe((data) => {
            this.orgdetails = data;
          });
      } else {
        this.adminService
          .GetOrganizationById(this.orgnaizatioId)
          .subscribe((data) => {
            this.orgdetails = data;
          });
      }
    }
  }
  ngOnInit(): void {
    if (!this.loginuser) {
      this.router.navigate(['/login']);
      return;
    }

    this.FilterForm = this.formBuilder.group({
      organizationName: [],

      //pagenumber: [this.p]
    });
    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        const seen = new Set<string>();
        this.orglist = data.organizations.filter(
          (org: {
            api_user_id: string;
            organizationType: string;
            name: string;
          }) => {
            if (org.organizationType === 'Registrant' || seen.has(org.name))
              return false;
            seen.add(org.name);
            return true;
          },
        );
      });
    } else if (this.loginuser.role === 'Registrant') {
      this.orgService.GetRegistrantAllOrganization().subscribe((data) => {
        const seen = new Set<string>();
        this.orglist = data.organizations.filter((org: { name: string }) => {
          if (seen.has(org.name)) return false;
          seen.add(org.name);
          return true;
        });
      });
    }

    this.applyorgFilter();
    this.loading = false;
    this.getAllUsers(this.p);
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  applyorgFilter() {
    this.filteredOptions = this.FilterForm.controls[
      'organizationName'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value ?? '')),
    );
  }

  private _filter(value: any): string[] {
    if (!value || typeof value !== 'string') {
      return this.orglist;
    }

    const filterValue = value.toLowerCase();

    const filteredList = this.orglist.filter((option: any) =>
      option.name.toLowerCase().includes(filterValue),
    );

    this.showerror = filteredList.length === 0;

    return filteredList;
  }

  selectOrg(event: any) {
    const selectedName = event.option.value;
    const selectedorg = this.orglist.find(
      (org: any) => org.name === selectedName,
    );
    if (selectedorg) {
      this.orgnaizatioId = selectedorg.id;
    }
  }
  applySearch() {
    if (!this.allUsers.length) return;
    const term = (this.searchText || '').trim().toLowerCase();
    if (!term) {
      this.dataSource = new MatTableDataSource(this.allUsers);
      return;
    }
    const filtered = this.allUsers.filter(
      (u: any) =>
        (u.firstName + ' ' + u.lastName).toLowerCase().includes(term) ||
        u.email?.toLowerCase().includes(term) ||
        u.organization?.name?.toLowerCase().includes(term) ||
        u.role?.toLowerCase().includes(term),
    );
    this.dataSource = new MatTableDataSource(filtered);
  }
  getAllUsers(page: number) {
    const limit = 10000;
    if (this.loginuser.role === 'Admin') {
      if (this.orgnaizatioId != null || this.orgnaizatioId != undefined) {
        this.getAllUserByorganzationId(page, limit);
      } else {
        this.getadminAllUserList(page, limit);
      }
    } else {
      this.showorg = true;
      if (this.loginuser.role === 'Registrant') {
        if (this.orgnaizatioId != null || this.orgnaizatioId != undefined) {
          this.getAllUserByorganzationId(page, limit);
        } else {
          this.showorguser = false;
          this.showorg = false;
          this.showlist = true;
          this.getOrganizationAllUser(page, limit);
        }
      } else {
        this.getOrganizationAllUser(page, limit);
      }
    }
  }
  getadminAllUserList(page: number, limit: number) {
    this.adminService.GetAllUsers(page, limit).subscribe({
      next: (data) => {
        this.showlist = true;
        this.showorguser = false;
        this.loading = false;
        this.allUsers = data.users;
        this.dataSource = new MatTableDataSource(this.allUsers);
      },
      error: (err) => {
        this.loading = false;
        this.handleApiError(err);
      },
    });
  }
  getOrganizationAllUser(page: number, limit: number) {
    this.orgService.getOrganizationUser(page, limit).subscribe({
      next: (data) => {
        this.showlist = true;
        this.loading = false;
        this.allUsers = (data as any).users;
        this.dataSource = new MatTableDataSource(this.allUsers);
      },
      error: (err) => {
        this.loading = false;
        this.handleApiError(err);
      },
    });
  }
  getAllUserByorganzationId(page: number, limit: number) {
    this.adminService
      .GetAllOrgnaizationUsers(this.orgnaizatioId, page, limit)
      .subscribe({
        next: (data) => {
          this.showorguser = false;
          this.showlist = true;
          this.loading = false;
          this.allUsers = data.users;
          this.dataSource = new MatTableDataSource(this.allUsers);
        },
        error: (err) => {
          this.loading = false;
          this.handleApiError(err);
        },
      });
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
      height: '350px',
    });
    confirmDialog.afterClosed().subscribe((result) => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        this.getAllUsers(this.p);
      }
    });
  }

  openDialog(user: any) {
    if (this.loginuser.role === 'Admin') {
      if (user.role === 'Registrant' || user.role === 'Buyer') {
        const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
          data: {
            title: 'Are you sure? This cannot be undone.',
            message:
              'WARNING: This will permanently delete user ' +
              user.firstName +
              ' ' +
              user.lastName +
              ' and all their data. This action cannot be undone. If yes, please assign this role to another user of this organization first.',
            data: user,
            showchangeform: true,
          },
        });
        confirmDialog.afterClosed().subscribe((result) => {
          if (result === true) {
            // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
            this.admindeleteUser(user.id);
          }
        });
      } else {
        const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
          data: {
            title: 'Are you sure? This cannot be undone.',
            message:
              'WARNING: This will permanently delete user ' +
              user.firstName +
              ' ' +
              user.lastName +
              ' and all their data. This action cannot be undone.',
          },
        });
        confirmDialog.afterClosed().subscribe((result) => {
          if (result === true) {
            // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
            this.admindeleteUser(user.id);
          }
        });
      }
    } else {
      const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
        data: {
          title: 'Are you sure? This cannot be undone.',
          message:
            'WARNING: This will permanently delete user ' +
            user.firstName +
            ' ' +
            user.lastName +
            ' and all their data. This action cannot be undone.',
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
  admindeleteUser(id: number) {
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
  deleteUser(id: number) {
    this.orgService.removeUser(id).subscribe(
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
  private handleApiError(err: any): void {
    const statusCode = err.error?.statusCode || err.status;
    const message = err.error?.message || err.message || 'Unknown error';
    if (statusCode === 403) {
      this.toastrService.error(
        "You don't have the permissions to access the users page.",
        'Access Denied',
      );
    } else {
      this.toastrService.error(message, `Error ${statusCode || ''}`);
    }
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
        this.p = 1;
        this.getAllUsers(this.p);
      }
    });
  }
}
