import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { AuthbaseService } from '../../auth/authbase.service';
import { UserService, InvitationService } from '../../auth/services';
import { Router } from '@angular/router';
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
  // loginForm: FormGroup;
  constructor(
    private authService: AuthbaseService,
    private router: Router,
    private toastrService: ToastrService,
    private userService: UserService,
    private inviteservice: InvitationService,
  ) {}
  ngOnInit() {
    // Set the default option here (e.g., "option1")
    this.selectedOption = 'Form1';
  }
  padBase64(token: any) {
    const base64 = token.replace('-', '+').replace('_', '/');
    return base64;
  }
  b64DecodeUnicode(token: any) {
    const base64Payload = window.atob(token);
    return base64Payload;
  }
  onSubmit() {
    this.authService.login('auth/login', this.loginForm.value).subscribe({
      next: (data) => {
        if (data['accessToken'] != null) {
          // Use utility function to store user session data
          storeUserSession(data['accessToken']);

          // Get the decoded token
          const jwtObj = decodeJwtToken(data['accessToken']);

          // Get additional user profile data
          this.userService.userProfile().subscribe({
            next: (userData) => {
              // Store additional user data
              storeUserSession(data['accessToken'], userData);

              if (
                userData.status != 'Pending' &&
                userData.organization != null
              ) {
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
              } else {
                this.inviteservice.getinvitationByemail().subscribe({
                  next: (invitationData) => {
                    const invitationId = invitationData.id;
                    const loginuser = JSON.parse(
                      sessionStorage.getItem('loginuser') as any,
                    );
                    // Update the role property of the loginuser object with the new value
                    loginuser.role = invitationData.role;
                    // Save the updated loginuser object back to sessionStorage
                    sessionStorage.setItem(
                      'loginuser',
                      JSON.stringify(loginuser),
                    );
                    this.inviteservice
                      .acceptinvitaion(invitationId, {
                        email: jwtObj.email,
                        status: 'Accepted',
                      })
                      .subscribe({
                        next: () => {
                          this.toastrService.success(
                            'Accept Sucessful!',
                            'Invitation ',
                          );
                          this.onSubmit();
                        },
                      });
                  },
                });
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
        //Error callback
        console.error('error caught in component', error);
        this.toastrService.error('Check Your Credential!', 'Login Fail!!');
      },
    });
  }

  @Output() submitEM = new EventEmitter();
}
