import { Component, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { AuthbaseService } from '../../../auth/authbase.service';
import { AdminService, OrganizationService } from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { getOrgTypeName } from '../../../utils/role-helper';
@Component({
  standalone: false,
  selector: 'app-admin-organization',
  templateUrl: './admin-organization.component.html',
  styleUrls: ['./admin-organization.component.scss'],
})
export class AdminOrganizationComponent {
  getOrgTypeName = getOrgTypeName;
  displayedColumns = ['name', 'type', 'status', 'created', 'no of users', 'actions'];
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  loginuser: any;
  showlist: boolean = false;
  searchText: string = '';
  allOrgs: any[] = [];
  constructor(
    private authService: AuthbaseService,
    private adminService: AdminService,
    private router: Router,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute,
    private orgService: OrganizationService,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }
  ngOnInit() {
    if (this.loginuser.role === 'Admin') {
      this.getAllOrganization();
    } else if (this.loginuser.role === 'MarketIntermediary') {
      this.getApiuserAllOrganization();
    }
  }

  applySearch() {
    if (!this.allOrgs.length) return;
    const term = (this.searchText || '').trim().toLowerCase();
    if (!term) {
      this.dataSource = new MatTableDataSource(this.allOrgs);
      return;
    }
    const filtered = this.allOrgs.filter((org: any) =>
      org.name?.toLowerCase().includes(term) ||
      org.organizationType?.toLowerCase().includes(term) ||
      org.status?.toLowerCase().includes(term),
    );
    this.dataSource = new MatTableDataSource(filtered);
  }

  getAllOrganization() {
    this.adminService
      .GetAllOrganization(1, 10000, { organizationType: 'MarketIntermediary' })
      .subscribe({
        next: (data) => {
          this.showlist = true;
          this.allOrgs = data.organizations;
          this.dataSource = new MatTableDataSource(this.allOrgs);
          this.dataSource.sort = this.sort;
        },
        error: () => {
          this.showlist = false;
        },
      });
  }
  getApiuserAllOrganization() {
    this.orgService
      .GetApiUserAllOrganization(1, 10000)
      .subscribe({
        next: (data) => {
          this.showlist = true;
          this.allOrgs = data.organizations;
          this.dataSource = new MatTableDataSource(this.allOrgs);
          this.dataSource.sort = this.sort;
        },
        error: () => {
          this.showlist = false;
        },
      });
  }
}
