import { Input, Component, Output, EventEmitter, OnInit } from '@angular/core';
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
export class LoginComponent implements OnInit {
  loginForm: FormGroup = new FormGroup({
    username: new FormControl(''),
    password: new FormControl(''),
  });
  selectedOption: string;
  clientid: string;
  client_secret: string;
  // loginForm: FormGroup;
  constructor(private authService: AuthbaseService,
    private router: Router, private toastrService: ToastrService,
    private userService: UserService,
    private inviteservice: InvitationService) {

  }
  ngOnInit() {
    // Set the default option here (e.g., "option1")
    this.selectedOption = "Form1";
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
    if (this.selectedOption === "Form1") {
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
                  if (data1.organization.organizationType === 'Buyer') {
                    this.router.navigate(['/myreservation']);
                  } else if (jwtObj.role === 'Admin') {
                    this.router.navigate(['/admin/All_devices']);
                  } else {
                    console.log("50developer")
                    this.router.navigate(['/device/AllList']);
                  }
                  this.toastrService.success('Login user ' + jwtObj.email + '!', 'Login Success');
                } else {

                  this.inviteservice.getinvitationByemail().subscribe({
                    next: data => {
                      console.log(data);
                      const invitationId = data.id
                      //@ts-ignore
                      let loginuser = JSON.parse(sessionStorage.getItem('loginuser'));

                      // Update the role property of the loginuser object with the new value
                      loginuser.role = data.role;
                      console.log(loginuser);

                      // Save the updated loginuser object back to sessionStorage
                      sessionStorage.setItem('loginuser', JSON.stringify(loginuser));
                      this.inviteservice.acceptinvitaion(invitationId, {
                        email: jwtObj.email,
                        status: "Accepted"
                      }).subscribe({
                        next: data => {
                          console.log(data);
                          this.toastrService.success('Accept Sucessful!', 'Invitation ');
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
            this.toastrService.info('Message Failure!', 'Check Your Credentials !!');
            this.router.navigate(['/login']);
          }
        },
        (error) => {                              //Error callback
          console.error('error caught in component', error)
          this.toastrService.error('Check Your Credential!', 'Login Fail!!');
        }
      )
    } else if (this.selectedOption === "Form2") {

      this.authService.ApiUserlogin('auth/login', this.clientid, this.client_secret, this.loginForm.value).subscribe({
        next: (data: any) => {
          if (data["accessToken"] != null) {
            sessionStorage.setItem('access-token', data["accessToken"]);
            let jwtObj = JSON.parse(this.b64DecodeUnicode(this.padBase64(data["accessToken"].split('.')[1])));
           
            jwtObj['clientId']= this.clientid
            jwtObj['clientSecret']=this.client_secret
            //sessionStorage.setItem('loginuser', jwtObj);
            sessionStorage.setItem('loginuser', JSON.stringify(jwtObj));
           
            //var obj = JSON.parse(sessionStorage.loginuser);
            this.userService.userProfile(this.clientid, this.client_secret,).subscribe({
              next: data1 => {
                console.log(data1)
                sessionStorage.setItem('status', data1.status);
                setTimeout(() => {
                  //  this.loading=false;
                  this.router.navigate(['/apiuser/All_devices']);
                },1000)
               

              }, error: err => {
                this.toastrService.error('Error!', err.error.message);
              }
            })
          } else {
            console.log("check your credentials !!")
            this.toastrService.info('Message Failure!', 'Check your credentials !!');
            this.router.navigate(['/login']);
          }
        },
        error: error => {                              //Error callback
          console.error('error caught in component', error)
          this.toastrService.error('Error: ' +
            'Check your credentials!', 'Login Fail!!');
        }
      }
      )
    }

  }

  @Output() submitEM = new EventEmitter();
}
