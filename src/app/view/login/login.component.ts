import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { AuthbaseService } from '../../auth/authbase.service';
import { UserService, InvitationService } from '../../auth/services';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { decodeJwtToken, storeUserSession } from '../../utils/token-utils';
import { RoleModeService } from '../../auth/services/role-mode.service';

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

  @Output() submitEM = new EventEmitter();

  constructor(
    private authService: AuthbaseService,
    private router: Router,
    private toastrService: ToastrService,
    private userService: UserService,
    private inviteservice: InvitationService,
    private activatedRoute: ActivatedRoute,
    private roleModeService: RoleModeService,
  ) {}

  ngOnInit() {
    this.selectedOption = 'Form1';
  }

  /**
   * Handle login form submission
   */
  onSubmit() {
    this.loginError = '';
    this.authService.login('auth/login', this.loginForm.value).subscribe({
      next: (data) => {
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
        console.error('error caught in component', error);
        const user = this.loginForm.value.username || '';
        this.loginError = `Login failed for "${user}". Please check your username and password.`;
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
