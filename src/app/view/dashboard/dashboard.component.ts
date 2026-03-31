import { Component, OnInit } from '@angular/core';
import { OrganizationService } from '../../auth/services';
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
  apiUserOrganizations: any[] = [];
  apiUserOrgsError: string | null = null;
  loginuser: any;
  getOrgTypeName = getOrgTypeName;

  get isApiMode(): boolean {
    return this.roleModeService.currentMode === 'api';
  }

  set isApiMode(value: boolean) {
    this.roleModeService.setMode(value ? 'api' : 'ui');
  }

  get isApiUser(): boolean {
    return this.loginuser?.role === 'ApiUser';
  }

  constructor(
    private orgService: OrganizationService,
    private roleModeService: RoleModeService,
  ) {}

  get isAdmin(): boolean {
    return this.loginuser?.role === 'Admin';
  }

  ngOnInit() {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    if (this.isAdmin) {
      this.organization = {
        name: 'D-REC',
        organizationType: 'Admin',
        status: 'Active',
      };
    } else if (this.isApiUser) {
      this.orgService.GetApiUserAllOrganization().subscribe({
        next: (data) => {
          this.apiUserOrganizations = data.organizations ?? [];
        },
        error: (err) => {
          this.apiUserOrgsError = `Error ${err.status}: ${err.error?.message ?? err.message}`;
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
