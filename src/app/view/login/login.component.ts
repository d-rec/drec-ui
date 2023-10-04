import { Input, Component, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { AuthbaseService } from '../../auth/authbase.service';
import { UserService, InvitationService } from '../../auth/services';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent {
  loginForm: FormGroup = new FormGroup({
    username: new FormControl(''),
    password: new FormControl(''),
  });
  // loginForm: FormGroup;
  constructor(private authService: AuthbaseService,
    private router: Router, private toastrService: ToastrService,
    private userService: UserService,
    private inviteservice: InvitationService) {

  }
  // submit() {
  //   if (this.form.valid) {
  //     this.submitEM.emit(this.form.value);
  //   }
  // }
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
                if ( data1.organization.organizationType==='Buyer' ) {
                  this.router.navigate(['/myreservation']);
                } else if (jwtObj.role === 'Admin') {
                  this.router.navigate(['/admin/All_devices']);
                } else {
                  console.log("50developer")
                  this.router.navigate(['/device/AllList']);
                }
                this.toastrService.success('login user ' + jwtObj.email + '!', 'login Success');
              } else {

                this.inviteservice.getinvitaion().subscribe({
                  next: data => {
                    console.log(data);
                    const invitationId = data[0].id
                    //@ts-ignore
                    let loginuser = JSON.parse(sessionStorage.getItem('loginuser'));

                    // Update the role property of the loginuser object with the new value
                    loginuser.role = data[0].role;
                    console.log(loginuser);

                    // Save the updated loginuser object back to sessionStorage
                    sessionStorage.setItem('loginuser', JSON.stringify(loginuser));
                    this.inviteservice.acceptinvitaion(invitationId, {
                      email: jwtObj.email,
                      status: "Accepted"
                    }).subscribe({
                      next: data => {
                        console.log(data);
                        this.toastrService.success('accept sucessful!', 'Invitation ');
                        this.onSubmit();
                      }
                    })
                  }
                })
                //this.router.navigate(['/organization/user/invitation']);

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
  }

  @Output() submitEM = new EventEmitter();
}
