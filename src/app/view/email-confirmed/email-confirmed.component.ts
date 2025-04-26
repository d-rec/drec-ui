import { Component, OnInit } from '@angular/core';
import { UserService } from '../../auth/services/user.service';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { decodeJwtToken, storeUserSession } from '../../utils/token-utils';

@Component({
  selector: 'app-confirmemail',
  templateUrl: './email-confirmed.component.html',
  styleUrls: ['./email-confirmed.component.scss'],
})
export class EmailConfirmedComponent implements OnInit {
  accesstoken: any;
  message: string;
  success: boolean = true;

  constructor(
    private userService: UserService,
    private toastrService: ToastrService,
    private route: ActivatedRoute,
    private router: Router,
  ) {
    this.checkForEmailConfirmationToken();
  }

  ngOnInit() {}

  private checkForEmailConfirmationToken(): void {
    this.route.queryParams.subscribe((params) => {
      if (params['token'] != undefined) {
        this.accesstoken = params['token'];
        this.getConfirmemail(this.accesstoken);
      } else {
        this.message = 'Invalid confirmation link';
        this.success = false;
        this.toastrService.error('Invalid confirmation link');
      }
    });
  }

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
}
