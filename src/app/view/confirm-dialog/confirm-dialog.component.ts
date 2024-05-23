import { Component, Inject } from '@angular/core';
import {
  MatDialogRef,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { AdminService, OrganizationService } from '../../auth/services';
import { ToastrService } from 'ngx-toastr';
import {
  FormGroup,
  FormBuilder,
  Validators,
} from '@angular/forms';
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.component.html',
  styleUrls: ['./confirm-dialog.component.scss'],
})
export class ConfirmDialogComponent {
  title: string;
  message: string;
  loading: boolean = true;
  showchangeform: boolean = false;
  user: any;
  alluserlist: any;
  roleForm: FormGroup;
  userId: number;
  dailogmessage: string;
  role: string = 'OrganizationAdmin';
  constructor(
    private fb: FormBuilder,
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private adminService: AdminService,
    private organizationService: OrganizationService,
    private toastrService: ToastrService,
  ) {
    if (data.showchangeform) {
      this.dailogmessage = data.message;
      this.user = data.data;
      //this.showchangeform = data.showchangeform;
    } else {
      this.loading = false;
      this.message = data.message;
    }
  }
  ngOnInit() {
    setTimeout(() => {
      if (this.data.showchangeform) {
        this.getAlluseroforg();
      }
    }, 500);

    this.roleForm = this.fb.group({
      role: [null, Validators.required],
    });
  }

  getAlluseroforg() {
    this.adminService
      .GetAllOrgnaizationUsers(this.user.organization.id)
      .subscribe({
        next: (data) => {
          this.alluserlist = data.users;
          if (this.alluserlist.length > 1) {
            this.message = this.dailogmessage;
            this.showchangeform = true;
            this.loading = false;
          } else {
            this.loading = false;
            this.message =
              'Are you sure, you want to remove User: ' +
              this.user.firstName +
              '' +
              this.user.lastName;
          }
        },
      });
  }
  onUpdateorgadminrole() {
    if (this.showchangeform) {
      this.organizationService
        .changeOrguserRole(
          this.user.organization.id,
          this.user.id,
          this.roleForm.value,
        )
        .subscribe((data) => {
          this.toastrService.success(data.message+'Role Updated')
          
        });
    }
  }
}
