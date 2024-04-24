import { Component, Inject } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { AdminService } from '../../auth/services/admin.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { startWith, map } from 'rxjs/operators';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { UserStatus } from '../../utils/drec.enum'
@Component({
  selector: 'app-edit-user',
  templateUrl: './edit-user.component.html',
  styleUrls: ['./edit-user.component.scss']
})
export class EditUserComponent {
  updateForm: FormGroup;
  userinfo: any;
  userid: number;
  firstName: string = "";
  lastName: string = "";
  email: string = "";
  userstatus: any = UserStatus;
  emailregex: RegExp = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
  fieldRequired: string = "This field is required"
  constructor(private fb: FormBuilder,
    private adminService: AdminService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
    public dialogRef: MatDialogRef<EditUserComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) {
    //this.userid = this.activatedRoute.snapshot.params['id'];
  
  }
  ngOnInit() {
    this.updateForm = this.fb.group({
      firstName: [this.data.userinfo.firstName, Validators.required],
      lastName: [this.data.userinfo.lastName],
      email: [this.data.userinfo.email, [Validators.required, Validators.pattern(this.emailregex)]],
      status: [this.data.userinfo.status, Validators.required],
    });
  }
  emaiErrors() {
    return this.updateForm.get('email')?.hasError('required') ? 'This field is required' :
      this.updateForm.get('email')?.hasError('pattern') ? 'Not a valid emailaddress' : ''

  }
  // checkValidation(input: string) {
  //   const validation = this.updateForm.get(input)?.invalid && (this.updateForm.get(input)?.dirty || this.updateForm.get(input)?.touched)
  //   return validation;
  // }
  onUpdate() {

    this.adminService.updateUser(this.data.userinfo.id, this.updateForm.value).subscribe({
      next: data => {
        this.toastrService.success("User Updated", "Successful")
        this.dialogRef.close();

      }, error: err => {
        this.toastrService.error(err.error.message, "Error")
      }
    })

  }

}

