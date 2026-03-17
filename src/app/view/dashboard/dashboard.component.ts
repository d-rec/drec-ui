import { Component, OnInit } from '@angular/core';
import { OrganizationService } from '../../auth/services';
import { RoleModeService } from '../../auth/services/role-mode.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss'],
})
export class DashboardComponent implements OnInit {
  organization: any = {};
  apiUserOrganizations: any[] = [];
  apiUserOrgsError: string | null = null;
  loginuser: any;

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

  ngOnInit() {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser') || '{}');
    if (this.isApiUser) {
      this.orgService.GetApiUserAllOrganization().subscribe({
        next: (data) => {
          console.log('GetApiUserAllOrganization response:', data);
          this.apiUserOrganizations = data.organizations ?? [];
        },
        error: (err) => {
          console.error('GetApiUserAllOrganization error:', err);
          this.apiUserOrgsError = `Error ${err.status}: ${err.error?.message ?? err.message}`;
        },
      });
    } else {
      this.orgService.getOrganizationInformation().subscribe((data) => {
        this.organization = data;
      });
    }
  }
}
