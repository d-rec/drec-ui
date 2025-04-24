import { Component, OnInit } from '@angular/core';
import { UserService } from '../../auth/services/user.service';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-confirmemail',
  templateUrl: './confirmemail.component.html',
  styleUrls: ['./confirmemail.component.scss'],
})
export class ConfirmEmailComponent implements OnInit {
  accesstoken: any;
  fromregister: boolean = true;
  message: string;
  success: boolean = true;

  constructor(
    private userService: UserService,
    private toastrService: ToastrService,
  ) {}

  ngOnInit() {}

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
