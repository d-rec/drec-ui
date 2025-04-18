import { Component, OnInit } from '@angular/core';
import { UserService } from '../../auth/services/user.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { decodeJwtToken, storeUserSession } from '../../utils/token-utils';

@Component({
  selector: 'app-confirmemail',
  templateUrl: './confirmemail.component.html',
  styleUrls: ['./confirmemail.component.scss'],
})
export class ConfirmemailComponent implements OnInit {
  accesstoken: any;
  fromregister: boolean = true;
  message: string;
  success: boolean = true;

  constructor(
    private userService: UserService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
  ) {
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['token'] != undefined) {
        this.accesstoken = params['token'];
        this.fromregister = false;
        this.getConfirmemail(this.accesstoken);
      }
    });
  }

  ngOnInit() {}

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

              if (
                userData.organization &&
                userData.organization.organizationType === 'Buyer'
              ) {
                this.router.navigate(['/myreservation']);
              } else if (jwtObj.role === 'Admin') {
                this.router.navigate(['/admin/All_devices']);
              } else {
                this.router.navigate(['/device/AllList']);
              }

              this.toastrService.success(
                `Login user ${jwtObj.email}!`,
                'Login Success',
              );
            },
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

  resendConfirmationEmail() {
    this.userService.resendConfirmationEmail().subscribe({
      next: () => {
        this.toastrService.success('Email sent successfully');
      },
      error: (err) => {
        this.toastrService.error(err.error.message);
      },
    });
  }
}
