import { Component, Output, EventEmitter, OnInit } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { AuthbaseService } from '../../auth/authbase.service';
import { UserService, InvitationService } from '../../auth/services';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
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
    this.authService.login('auth/login', this.loginForm.value).subscribe(
      (data) => {
        if (data['accessToken'] != null) {
          sessionStorage.setItem('access-token', data['accessToken']);
          const jwtObj = JSON.parse(
            this.b64DecodeUnicode(
              this.padBase64(data['accessToken'].split('.')[1]),
            ),
          );

          //sessionStorage.setItem('loginuser', jwtObj);
          sessionStorage.setItem('loginuser', JSON.stringify(jwtObj));
          //var obj = JSON.parse(sessionStorage.loginuser);
          this.userService.userProfile().subscribe({
            next: (data1) => {
              sessionStorage.setItem('status', data1.status);
              sessionStorage.setItem('apiuserId', data1.api_user_id);
              if (data1.status != 'Pending' && data1.organization != null) {
                if (data1.organization.organizationType === 'Buyer') {
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
                  next: (data) => {
                    const invitationId = data.id;
                    const loginuser = JSON.parse(
                      sessionStorage.getItem('loginuser') as any,
                    );
                    // Update the role property of the loginuser object with the new value
                    loginuser.role = data.role;
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
      (error) => {
        //Error callback
        console.error('error caught in component', error);
        this.toastrService.error('Check Your Credential!', 'Login Fail!!');
      },
    );
  }

  @Output() submitEM = new EventEmitter();
}
