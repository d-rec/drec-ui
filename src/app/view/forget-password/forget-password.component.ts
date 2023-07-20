import { Input, Component, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { UserService } from '../../auth/services/user.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-forget-password',
  templateUrl: './forget-password.component.html',
  styleUrls: ['./forget-password.component.scss']
})
export class ForgetPasswordComponent {
  ForgetpasswordForm: FormGroup = new FormGroup({
    email: new FormControl(''),

  });
  message: string;
  showform:boolean=true;
  // loginForm: FormGroup;
  constructor(private authService: UserService, private router: Router, private toastrService: ToastrService) {

  }
  onSubmit() {
    console.log(this.ForgetpasswordForm.value)
    this.authService.UserForgetPassword(this.ForgetpasswordForm.value).subscribe(
      (data) => {
       
          this.message =data.message
          this.showform=false
       

      })
  }
}
