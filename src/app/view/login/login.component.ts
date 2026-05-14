import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthbaseService } from '../../auth/authbase.service';
import { UserService, InvitationService } from '../../auth/services';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { decodeJwtToken, storeUserSession } from '../../utils/token-utils';
import { RoleModeService } from '../../auth/services/role-mode.service';
import {
  VersionService,
  AppVersion,
} from '../../auth/services/version.service';
import { environment } from '../../../environments/environment';

interface PlatformStats {
  gwhCommitted: number;
  countries: number;
  devices: number;
  sites: number;
}

@Component({
  standalone: false,
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup = new FormGroup({
    username: new FormControl(''),
    password: new FormControl(''),
  });

  selectedOption: string;
  clientid: string;
  client_secret: string;
  hide = true;
  accesstoken: any;
  fromregister: boolean = true;
  message: string;
  success: boolean = true;
  loginError: string = '';
  loggingIn: boolean = false;
  loginElapsed: number = 0;
  private loginTimer: any = null;
  versionLine: string = '';
  platformStats: PlatformStats | null = null;

  @Output() submitEM = new EventEmitter();

  constructor(
    private authService: AuthbaseService,
    private router: Router,
    private toastrService: ToastrService,
    private userService: UserService,
    private inviteservice: InvitationService,
    private activatedRoute: ActivatedRoute,
    private roleModeService: RoleModeService,
    private versionService: VersionService,
    private http: HttpClient,
  ) {}

  ngOnInit() {
    this.selectedOption = 'Form1';
    this.versionService.get().subscribe((v) => {
      this.versionLine = this.formatVersion(v);
    });
    this.http.get<PlatformStats>(`${environment.API_URL}stats`).subscribe({
      next: (s) => (this.platformStats = s),
      error: () => {
        // Silent fail — login still works without stats overlay.
      },
    });
  }

  private formatVersion(v: AppVersion | null): string {
    if (!v || v.buildTime === 'unknown') return '';
    const ts = this.formatBuildTime(v.buildTime);
    if (!ts) return '';
    const ver = v.version && v.version !== 'unknown' ? `v${v.version}` : '';
    const sha = v.sha && v.sha !== 'unknown' ? v.sha.slice(0, 8) : '';
    const parts = [ts, ver, sha].filter(Boolean);
    return `Last deployed: ${parts.join(' · ')}`;
  }

  private formatBuildTime(iso: string): string {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
  }

  /**
   * Handle login form submission
   */
  onSubmit() {
    if (this.loggingIn) return;
    this.loginError = '';
    this.loggingIn = true;
    this.loginElapsed = 0;
    const started = Date.now();
    this.loginTimer = setInterval(() => {
      this.loginElapsed = Math.floor((Date.now() - started) / 100) / 10;
    }, 100);
    this.authService.login('auth/login', this.loginForm.value).subscribe({
      next: (data) => {
        this.loggingIn = false;
        clearInterval(this.loginTimer);
        if (data['accessToken'] != null) {
          storeUserSession(data['accessToken']);
          const jwtObj = decodeJwtToken(data['accessToken']);

          this.userService.userProfile().subscribe({
            next: (userData) => {
              storeUserSession(data['accessToken'], userData);

              this.roleModeService.initFromRole(jwtObj.role);

              if (
                userData.status != 'Pending' &&
                userData.organization != null
              ) {
                this.navigateBasedOnUserType(userData, jwtObj);
              } else {
                this.handlePendingUser(jwtObj);
              }
            },
            error: (err) => {
              this.toastrService.error('Error!', err.error.message);
            },
          });
        } else {
          const user = this.loginForm.value.username || '';
          this.loginError = `Login failed for "${user}". Please check your username and password.`;
        }
      },
      error: (error) => {
        this.loggingIn = false;
        clearInterval(this.loginTimer);
        console.error('error caught in component', error);
        const user = this.loginForm.value.username || '';
        if (error.status === 0) {
          this.loginError =
            'Cannot reach the D-REC server. Check your network connection or try again in a moment.';
        } else if (error.status === 401) {
          this.loginError = `Login failed for "${user}". Please check your username and password.`;
        } else if (error.status === 403 && error.error?.message) {
          this.loginError = error.error.message;
        } else if (error.status >= 500) {
          const detail = error.error?.message ? ` (${error.error.message})` : '';
          this.loginError = `The D-REC server returned an error${detail}. Please try again shortly.`;
        } else {
          const detail = error.error?.message
            ? `: ${error.error.message}`
            : ` (HTTP ${error.status || 'unknown'})`;
          this.loginError = `Login failed for "${user}"${detail}.`;
        }
      },
    });
  }

  /**
   * Navigate user to appropriate page based on their type
   */
  private navigateBasedOnUserType(userData: any, jwtObj: any): void {
    this.router.navigate(['/dashboard']);
    this.toastrService.success(
      'Login user ' + jwtObj.email + '!',
      'Login Success',
    );
  }

  /**
   * Handle pending user by checking for invitations
   */
  private handlePendingUser(jwtObj: any): void {
    this.inviteservice.getinvitationByemail().subscribe({
      next: (invitationData) => {
        const invitationId = invitationData.id;
        const loginuser = JSON.parse(
          sessionStorage.getItem('loginuser') as any,
        );

        loginuser.role = invitationData.role;

        sessionStorage.setItem('loginuser', JSON.stringify(loginuser));

        this.inviteservice
          .acceptinvitaion(invitationId, {
            email: jwtObj.email,
            status: 'Accepted',
          })
          .subscribe({
            next: () => {
              this.toastrService.success('Accept Sucessful!', 'Invitation ');
              this.onSubmit();
            },
            error: (err) =>
              this.toastrService.error(
                'Error accepting invitation!',
                err.error.message,
              ),
          });
      },
      error: (err) =>
        this.toastrService.error(
          'Error fetching invitation!',
          err.error.message,
        ),
    });
  }
}
