import { Component, OnInit } from '@angular/core';
import { UserService, InvitationService } from '../../auth/services';
import { AuthbaseService } from '../../auth/authbase.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { errors } from 'ethers';
@Component({
  selector: 'app-user-accept-invitation',
  templateUrl: './user-accept-invitation.component.html',
  styleUrls: ['./user-accept-invitation.component.scss']
})
export class UserAcceptInvitationComponent {
  accesstoken: any;
  fromregister: boolean = true;
  message: string;
  success: boolean = true;
  invitaionId: number;
  useremail: string;
  constructor(private authService: AuthbaseService, 
    private inviteService: InvitationService,
    private userService: UserService, 
    private router: Router,
    private toastrService: ToastrService, private activatedRoute: ActivatedRoute) {

    this.activatedRoute.queryParams.subscribe(params => {
      console.log(params)
      if (params['email'] != undefined) {
        this.accesstoken = params['token'];
        this.invitaionId = params['invitaionId'];
        this.useremail = params['email'];
        console.log(this.accesstoken);
        this.fromregister = false;
        //this.getConfirmemail(this.accesstoken)
        sessionStorage.setItem('access-token', this.accesstoken);
        let jwtObj = JSON.parse(this.b64DecodeUnicode(this.padBase64(this.accesstoken.split('.')[1])));
        console.log(jwtObj);
      }
    });


  }

  ngOnInit() {
    setTimeout(() => {
      this.acceptinvitaion();

    }, 500)
  }
  padBase64(token: any) {
    const base64 = token.replace('-', '+').replace('_', '/');
    return base64;
  }
  b64DecodeUnicode(token: any) {
    const base64Payload = window.atob(token);
    return base64Payload;
  }
  acceptinvitaion() {
    //let jwtObj = JSON.parse(this.b64DecodeUnicode(this.padBase64(this.accesstoken.split('.')[1])));
    //console.log(jwtObj);
    let useronj = {
      email: this.useremail,
      status: 'Accepted'
    }
    this.inviteService.acceptinvitaion(this.invitaionId, useronj).subscribe({
      next: data => {
        if (data.success) {
          let loginForm = {
            username: this.useremail,
            password: 'pass@123'
          }
          this.toastrService.success('Successful!', 'Invitation Accepted !!');
          this.authService.login('auth/login', loginForm).subscribe(
            (data) => {
      
              if (data["accessToken"] != null) {
                sessionStorage.setItem('access-token', data["accessToken"]);
                let jwtObj = JSON.parse(this.b64DecodeUnicode(this.padBase64(data["accessToken"].split('.')[1])));
                console.log(jwtObj);
                //sessionStorage.setItem('loginuser', jwtObj);
                sessionStorage.setItem('loginuser', JSON.stringify(jwtObj));
                //var obj = JSON.parse(sessionStorage.loginuser);
                this.userService.userProfile().subscribe({
                  next: data1 => {
                    console.log(data1)
                    sessionStorage.setItem('status', data1.status);
                    if (data1.status != 'Pending' && data1.organization != null) {
                      if (jwtObj.role === 'Buyer') {
                        this.router.navigate(['/myreservation']);
                      } else if (jwtObj.role === 'Admin') {
                        this.router.navigate(['/admin/All_devices']);
                      } else {
                        console.log("50developer")
                        this.router.navigate(['/device/AllList']);
                      }
                      this.toastrService.success('login user ' + jwtObj.email + '!', 'login Success');
                    }else{
                      this.router.navigate(['/organization/user/invitation']);
      
                    }
      
                  }, error: err => {
                    this.toastrService.error('Error!', err.error.message);
                  }
                })
              } else {
                console.log("check your credentials !!")
                this.toastrService.info('Message Failure!', 'check your credentials !!');
                this.router.navigate(['/login']);
              }
            },
            (error) => {                              //Error callback
              console.error('error caught in component', error)
              this.toastrService.error('check your credentials!', 'login Fail!!');
            }
          )
         // this.router.navigate(['/login']);
        }

      }, error: err => {
        this.toastrService.warning('Message Failure!', err.error.message);
        this.router.navigate(['/login']);
      }
    })

  }
}
