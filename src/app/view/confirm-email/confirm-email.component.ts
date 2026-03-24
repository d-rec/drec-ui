import { Component, OnInit } from '@angular/core';
import { ToastrService } from 'ngx-toastr';
import { ActivatedRoute, Router } from '@angular/router';
import { UserService } from 'src/app/auth/services/user.service';

@Component({
  standalone: false,
  selector: 'app-confirm-email',
  templateUrl: './confirm-email.component.html',
  styleUrls: ['./confirm-email.component.scss'],
})
export class ConfirmEmailComponent implements OnInit {
  accessToken: any;
  message: string;
  success: boolean = true;

  constructor(
    private userService: UserService,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    private router: Router,
  ) {
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['token'] != undefined) {
        this.accessToken = params['token'];
        this.emailConfirmed(this.accessToken);
      }
    });
  }

  ngOnInit() {}

  emailConfirmed(accessToken: any) {
    this.userService.confirmEmail(accessToken).subscribe({
      next: (data: any) => {
        this.message = data.message;

        this.toastrService.success(' Successful !!', this.message);
      },
      error: (err: any) => {
        this.success = err.error.success;
        this.message = err.error.message;
        this.toastrService.error(' Failed !!', this.message);
      },
    });
  }
}
