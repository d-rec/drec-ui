import { Component, Inject, ViewChild } from '@angular/core';

import { FormBuilder, FormGroup, ReactiveFormsModule, FormsModule, FormControl } from '@angular/forms';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuthbaseService } from '../../../auth/authbase.service';
import { DeviceService, ACLModulePermisionService } from '../../../auth/services';
import { Router } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { ToastrService } from 'ngx-toastr';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-acl-module-permission',
  templateUrl: './acl-module-permission.component.html',
  styleUrls: ['./acl-module-permission.component.scss']
})
export class AclModulePermissionComponent {

  countrylist: any;
  countrycodeLoded: boolean = false;
  data: any[];
  displayedColumns = [
    "name",
    "status",
    "description",
    "permissions",
  ];

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;

  constructor(private authService: AuthbaseService, private deviceService: DeviceService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private toastrService: ToastrService,
    private aclpermissionService: ACLModulePermisionService) { }

  ngOnInit() {
    this.getaclmodulelist();
  }
  getaclmodulelist() {
    this.aclpermissionService.getAcl_moduleList().subscribe({
      next: data => {
        console.log(data)

        this.dataSource = new MatTableDataSource(data);
      }, error: err => {
        console.log(err)
      }
    })
  }
  openAclmoduleFormDialog() {
    const confirmDialog = this.dialog.open(AclModuleFormComponent, {
      data: {
        title: 'Add Acl Module',
        // message: 'Are you sure, you want to  Device: ',
        // orginfo: this.orgdetails
        height: '400px', width: '600px'
      }
    });
    confirmDialog.afterClosed().subscribe(result => {
      if (result === true) {
        setTimeout(() => {
          this.getaclmodulelist();
        }, 1000);
      }
    });
  }

}

@Component({
  selector: 'add_aclmodule_form',
  templateUrl: 'add_aclmodule_form.html',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatCardModule, ReactiveFormsModule,
    MatFormFieldModule, FormsModule, MatInputModule, MatSelectModule, CommonModule],
})
export class AclModuleFormComponent {
  title: string;
  message: string;
  aclModuleForm: FormGroup;
  aclModulePermission: any = ['Read', 'Write', 'Delete', 'Update']
  constructor(public dialogRef: MatDialogRef<AclModuleFormComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private toastrService: ToastrService, private aclmoduleService: ACLModulePermisionService) { }
  ngOnInit() {
    this.aclModuleForm = this.fb.group({
      name: [null],
      status: ['Enable'],
      description: [null],
      permissions: [[new FormControl([])]]
    });
  }

  onSubmit() {
    console.log(this.aclModuleForm.value);
    this.aclmoduleService.addACL_module(this.aclModuleForm.value).subscribe({
      next: data => {
        if (data) {
          this.toastrService.success('SuccessFul')
        }
      }, error: err => {
        this.toastrService.error('Fail', err.error.message)
      }
    })

  }

}