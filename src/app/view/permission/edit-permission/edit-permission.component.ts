import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import {
  DeviceService,
  ACLModulePermisionService,
} from '../../../auth/services';
import { Router } from '@angular/router';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { ToastrService } from 'ngx-toastr';
import { UserpermissionComponent } from '../add-userpermission/add-userpermission.component';
@Component({
  selector: 'app-edit-permission',
  templateUrl: './edit-permission.component.html',
  styleUrls: ['./edit-permission.component.scss'],
})
export class EditPermissionComponent {
  UserupdatePermissionForm: FormGroup;
  userrole: string;
  datalist: any;
  modulename: string;
  Permission: any = ['Read', 'Write', 'Delete', 'Update'];
  rolelist: any = [
    { id: 1, name: 'Admin' },
    { id: 2, name: 'OrganizationAdmin' },
    { id: 3, name: 'DeviceOwner' },
    { id: 4, name: 'Buyer' },
    { id: 5, name: 'User' },
    { id: 6, name: 'SubBuyer' },
    //{id:6,name:""},
    // {id:,name:""}
  ];
  userpermissioninf: any;
  userpermission: any = [];
  constructor(
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private formBuilder: FormBuilder,
    private router: Router,
    @Inject(MAT_DIALOG_DATA) data: { permission: any },
    public dialogRef: MatDialogRef<UserpermissionComponent>,
    private toastrService: ToastrService,
    private aclpermissionServcie: ACLModulePermisionService,
  ) {
    this.userpermissioninf = data.permission;

    this.userrole = this.userpermissioninf.entityId;
    this.modulename = this.userpermissioninf.aclmodulesId;
    this.userpermission = this.userpermissioninf.permissions;
  }
  ngOnInit() {
    this.getaclmodulepermission();
    this.UserupdatePermissionForm = this.formBuilder.group({
      permissions: [this.userpermission, Validators.required],
      status: 1,
    });
  }

  getaclmodulepermission() {
    this.aclpermissionServcie.getAcl_moduleList().subscribe({
      next: (data) => {
        this.datalist = data;
      },
      error: (err) => {
        this.toastrService.error('No Response', err);
      },
    });
  }
  updatepermission() {
    this.aclpermissionServcie
      .PutUserpermission(
        this.userpermissioninf.id,
        this.UserupdatePermissionForm.value,
      )
      .subscribe({
        next: (data) => {
          if (data) {
            this.toastrService.success('Updated successfully', 'Success');
            this.dialogRef.close();
          }
        },
        error: (err) => {
          this.toastrService.error('Fialed', err);
        },
      });
  }
}
