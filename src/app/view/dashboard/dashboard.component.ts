import { Component, OnInit } from '@angular/core';
import { OrganizationService, UserService } from '../../auth/services';
import { RoleModeService } from '../../auth/services/role-mode.service';
import { getOrgTypeName } from '../../utils/role-helper';

@Component({
  standalone: false,
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  organization: any = {};
  registrantOrganizations: any[] = [];
  registrantOrgsError: string | null = null;
  loginuser: any;
  accountCreatedAt: string | null = null;
  getOrgTypeName = getOrgTypeName;

  get isApiMode(): boolean {
    return this.roleModeService.currentMode === 'api';
  }

  set isApiMode(value: boolean) {
    this.roleModeService.setMode(value ? 'api' : 'ui');
  }

  get isRegistrant(): boolean {
    return this.loginuser?.role === 'Registrant';
  }

  constructor(
    private orgService: OrganizationService,
    private roleModeService: RoleModeService,
    private userService: UserService,
  ) {}

  get isAdmin(): boolean {
    return this.loginuser?.role === 'Admin';
  }

  ngOnInit() {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    this.userService.userProfile().subscribe({
      next: (user: any) => {
        this.accountCreatedAt = user.createdAt;
      },
    });
    if (this.isAdmin) {
      this.organization = {
        name: 'D-REC',
        organizationType: 'Admin',
        status: 'Active',
      };
    } else if (this.isRegistrant) {
      this.orgService.GetRegistrantAllOrganization().subscribe({
        next: (data) => {
          this.registrantOrganizations = data.organizations ?? [];
        },
        error: (err) => {
          this.registrantOrgsError = `Error ${err.status}: ${err.error?.message ?? err.message}`;
        },
      });
    } else {
      this.orgService.getOrganizationInformation().subscribe({
        next: (data) => {
          this.organization = data;
        },
        error: () => {
          // Fallback: use organization data from the stored user profile
          this.organization = {
            name: this.loginuser?.organization?.name ?? '—',
            organizationType: this.loginuser?.role ?? '—',
            status: this.loginuser?.status ?? '—',
          };
        },
      });
    }
  }
}
