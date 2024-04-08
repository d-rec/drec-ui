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
    //  clientid: new FormControl(''),
    // client_secret: new FormControl(''),

  });
  message: string;
  showform: boolean = true;
  selectedOption: string = "Yes";
  // loginForm: FormGroup;
  constructor(private authService: UserService, private router: Router, private toastrService: ToastrService) {

  }

  ngOnInit() {
    this.onInputChange()
  }
  onInputChange() {
    // Handle the change event here
    if (this.selectedOption === "Yes") {
      this.ForgetpasswordForm.addControl('clientid', new FormControl());
      this.ForgetpasswordForm.addControl('client_secret', new FormControl())

    } else if (this.selectedOption === "No") {
      this.ForgetpasswordForm.removeControl('clientid');
      this.ForgetpasswordForm.removeControl('client_secret')
    }
  }
  onSubmit() {
    this.authService.UserForgetPassword(this.ForgetpasswordForm.value).subscribe({
      next: data => {
        this.message = data.message
        this.showform = false
        this.toastrService.success(data.message, 'Sent Successfull !!');

      }, error: err => {
        this.toastrService.error(err.error.message, 'Message Failure !!');
      }
    })
  }
}
