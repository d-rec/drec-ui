import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { OrganizationService, UserService } from '../../auth/services';
import { RoleModeService } from '../../auth/services/role-mode.service';
import { getOrgTypeName } from '../../utils/role-helper';
import { environment } from '../../../environments/environment';

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
    private http: HttpClient,
    private router: Router,
    private toastr: ToastrService,
  ) {}

  get currentOrgId(): number | undefined {
    return this.loginuser?.organization?.id ?? this.loginuser?.organizationId;
  }

  /** Kebab → "Remove from my organizations". Detaches the org from
   *  the registrant family via the API, then reloads the list. If this
   *  is the last visible org, prompts about the consequence (you'll
   *  have no Registrant org left — your dashboard will be empty until
   *  an admin re-links one or you accept a new invitation). */
  confirmRemoveOrg(org: { id: number; name: string }): void {
    if (org.id === this.currentOrgId) {
      this.toastr.warning(
        'You cannot remove the organization you are currently logged into.',
      );
      return;
    }
    const visibleCount = this.registrantOrganizations.length;
    const isLast = visibleCount <= 1;
    const proceed = isLast
      ? window.confirm(
          `Removing "${org.name}" will leave you with NO organizations.\n\n` +
            'Your dashboard will be empty and most pages (Devices, Meter Reads, ' +
            'Bulk Upload, etc.) will not let you do anything until an admin ' +
            're-links your account to an organization or you accept an invitation ' +
            'to a new one.\n\n' +
            'Are you sure?',
        )
      : window.confirm(
          `Remove "${org.name}" from your organizations? The organization and ` +
            'its devices stay in the system — they just stop appearing in your ' +
            'dropdowns. Reversible by an admin.',
        );
    if (!proceed) return;
    this.http
      .delete(`${environment.API_URL}Organization/registrant/${org.id}/unlink`)
      .subscribe({
        next: () => {
          this.toastr.success(`Removed "${org.name}"`);
          this.registrantOrganizations = this.registrantOrganizations.filter(
            (o) => o.id !== org.id,
          );
        },
        error: (err) => {
          this.toastr.error(
            err?.error?.message ?? err?.message ?? 'Remove failed',
            'Error',
          );
        },
      });
  }

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
