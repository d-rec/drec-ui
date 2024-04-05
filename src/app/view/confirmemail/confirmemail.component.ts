import { Component, OnInit } from '@angular/core';
import { UserService } from '../../auth/services/user.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-confirmemail',
  templateUrl: './confirmemail.component.html',
  styleUrls: ['./confirmemail.component.scss']
})
export class ConfirmemailComponent implements OnInit {
  accesstoken: any;
  fromregister: boolean = true;
  message:string;
  success:boolean=true;
  constructor(private authService: UserService, private router: Router,
    private toastrService: ToastrService, private activatedRoute: ActivatedRoute) {
    // this.accesstoken = this.activatedRoute.snapshot.params['id'];
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['token'] != undefined) {
        this.accesstoken =params['token'];
        this.fromregister = false;
        this.getConfirmemail(this.accesstoken)
      }
    });
  }

  ngOnInit() {
  }
  getConfirmemail(accesstoken:any) {
    this.authService.UserConfirmEmail(accesstoken).subscribe({
      next: data2 =>
    {
        this.message=data2.message;

        this.toastrService.success(' Successful !!', 'Email Confirmed! ');

      },error:err=>{
        this.success=err.error.success;
        this.message=err.error.message;
        this.toastrService.success(' Fail !!', 'Email Confirm! ');
      }}
    )
  }
}
