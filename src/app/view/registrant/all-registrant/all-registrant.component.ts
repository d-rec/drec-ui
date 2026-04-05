import { Component, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { AuthbaseService } from '../../../auth/authbase.service';
import { AdminService, OrganizationService } from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../../confirm-dialog/confirm-dialog.component';
import { EditUserComponent } from '../../edit-user/edit-user.component';
import { ToastrService } from 'ngx-toastr';
import { InvitationformComponent } from '../../admin/invitationform/invitationform.component';
import { getRoleName } from '../../../utils/role-helper';

@Component({
  standalone: false,
  selector: 'app-all-registrant',
  templateUrl: './all-registrant.component.html',
  styleUrls: ['./all-registrant.component.scss'],
})
export class AllRegistrantComponent {
  displayedColumns = [
    'organization',
    'name',
    'email',
    'type',
    'status',
    'actions',
  ];
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  allUsers: any[] = [];
  showlist = false;
  loading = true;
  orgnaizatioId: number;
  showorg = false;
  orgdetails: any;
  loginuser: any;
  showorguser = true;
  searchText = '';
  registrantId: string;
  getRoleName = getRoleName;

  constructor(
    private authService: AuthbaseService,
    private orgService: OrganizationService,
    private adminService: AdminService,
    private router: Router,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute,
    private toastrService: ToastrService,
  ) {
    this.registrantId = sessionStorage.getItem('registrantId')!;
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
    this.loadAllUsers();
  }

  loadAllUsers(): void {
    if (this.loginuser.role !== 'Admin') return;

    const limit = 10000;
    this.adminService.GetAllRegistrants(1, limit, {}).subscribe((data) => {
      this.allUsers = data.users || [];
      this.showlist = true;
      this.showorguser = false;
      this.loading = false;
      this.dataSource = new MatTableDataSource(this.allUsers);
      this.dataSource.sort = this.sort;
    });
  }

  applySearch(): void {
    if (!this.allUsers.length) return;
    const term = (this.searchText || '').trim().toLowerCase();
    if (!term) {
      this.dataSource = new MatTableDataSource(this.allUsers);
      this.dataSource.sort = this.sort;
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
    this.dataSource.sort = this.sort;
  }

  openUpdateDialog(user: any) {
    const confirmDialog = this.dialog.open(EditUserComponent, {
      data: {
        title: 'Edit User',
        userinfo: user,
      },
      width: '900px',
      height: '300px',
    });
    confirmDialog.afterClosed().subscribe((result) => {
      if (result === true) {
        this.loadAllUsers();
      }
    });
  }

  openDialog(user: any) {
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
          this.deleteUser(user.id);
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
          this.loadAllUsers();
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
        this.loadAllUsers();
      }
    });
  }
}
