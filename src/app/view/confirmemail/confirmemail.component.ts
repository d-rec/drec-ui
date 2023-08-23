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
      console.log(params)
      if (params['token'] != undefined) {
        this.accesstoken =params['token'];
        console.log(this.accesstoken);
        this.fromregister = false;
        this.getConfirmemail(this.accesstoken)
      }
    });
  }

  ngOnInit() {

    //   this.authService.UserConfirmEmail(accesstoken).subscribe(
    //     (data2) => {
    //       // display list in the console 


    //     }
    //   )
  }
  getConfirmemail(accesstoken:any) {
    console.log(accesstoken)
    this.authService.UserConfirmEmail(accesstoken).subscribe({
      next: data2 =>
    {
        console.log(data2)
        // display list in the console 
        
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
