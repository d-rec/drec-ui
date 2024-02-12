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
     
      if (params['email'] != undefined) {
        this.accesstoken = params['token'];
        this.invitaionId = params['invitaionId'];
        this.useremail = params['email'];
       
        this.fromregister = false;
        //this.getConfirmemail(this.accesstoken)
        sessionStorage.setItem('access-token', this.accesstoken);
        let jwtObj = JSON.parse(this.b64DecodeUnicode(this.padBase64(this.accesstoken.split('.')[1])));
     
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

          this.toastrService.success('Successful!', 'Invitation Accepted !!');

          this.router.navigate(['/login']);
        }

      }, error: err => {
        this.toastrService.warning('Message Failure!', err.error.message);
        this.router.navigate(['/login']);
      }
    })

  }
}
