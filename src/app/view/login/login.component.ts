import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { AuthbaseService } from '../../auth/authbase.service';
import { UserService, InvitationService } from '../../auth/services';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { decodeJwtToken, storeUserSession } from '../../utils/token-utils';

@Component({
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

  @Output() submitEM = new EventEmitter();

  constructor(
    private authService: AuthbaseService,
    private router: Router,
    private toastrService: ToastrService,
    private userService: UserService,
    private inviteservice: InvitationService,
    private activatedRoute: ActivatedRoute,
  ) {
    this.checkForEmailConfirmationToken();
  }

  ngOnInit() {
    this.selectedOption = 'Form1';
  }

  /**
   * Check if there's an email confirmation token in the URL
   */
  private checkForEmailConfirmationToken(): void {
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['token'] != undefined) {
        this.accesstoken = params['token'];
        this.fromregister = false;
        this.getConfirmemail(this.accesstoken);
      }
    });
  }

  /**
   * Handle login form submission
   */
  onSubmit() {
    this.authService.login('auth/login', this.loginForm.value).subscribe({
      next: (data) => {
        if (data['accessToken'] != null) {
          storeUserSession(data['accessToken']);
          const jwtObj = decodeJwtToken(data['accessToken']);

          this.userService.userProfile().subscribe({
            next: (userData) => {
              storeUserSession(data['accessToken'], userData);

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
          this.toastrService.info(
            'Message Failure!',
            'Check Your Credentials !!',
          );
          this.router.navigate(['/login']);
        }
      },
      error: (error) => {
        console.error('error caught in component', error);
        this.toastrService.error('Check Your Credential!', 'Login Fail!!');
      },
    });
  }

  /**
   * Navigate user to appropriate page based on their type
   */
  private navigateBasedOnUserType(userData: any, jwtObj: any): void {
    if (userData.organization.organizationType === 'Buyer') {
      this.router.navigate(['/myreservation']);
    } else if (jwtObj.role === 'Admin') {
      this.router.navigate(['/admin/All_devices']);
    } else {
      this.router.navigate(['/device/AllList']);
    }

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

  /**
   * Handle email confirmation
   */
  getConfirmemail(accesstoken: any) {
    this.userService.UserConfirmEmail(accesstoken).subscribe({
      next: (data) => {
        this.message = data.message;
        this.success = data.success;

        if (data.success && data.accessToken) {
          storeUserSession(data.accessToken);
          const jwtObj = decodeJwtToken(data.accessToken);

          this.toastrService.success(
            'Email verified successfully. You are now logged in!',
          );

          this.userService.userProfile().subscribe({
            next: (userData) => {
              storeUserSession(data.accessToken, userData);
              this.navigateBasedOnUserType(userData, jwtObj);
            },
            error: (err) =>
              this.toastrService.error(
                'Error fetching profile!',
                err.error.message,
              ),
          });
        } else {
          this.toastrService.warning(
            this.message || 'Email confirmation process failed',
          );
        }
      },
      error: (err) => {
        this.success = false;
        this.message = err.error?.message || 'Unknown error occurred';
        this.toastrService.error(this.message || 'Email confirmation failed');
      },
    });
  }
}
