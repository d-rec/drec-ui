import { Component, Inject, ViewChild } from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { FormBuilder, FormGroup, FormControl, Validators } from '@angular/forms';
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

import { ToastrService } from 'ngx-toastr';
@Component({
  selector: 'app-add-userpermission',
  templateUrl: './add-userpermission.component.html',
  styleUrls: ['./add-userpermission.component.scss']
})
export class UserpermissionComponent {
  countrylist: any;
  countrycodeLoded: boolean = false;
  data: any[];
  datalist: any;
  userdatalist: any;
  displayedColumns = [
    "Role",
    "Module Name",
    "permissions",
  ];
  displayedColumns1 = [
    "select",
    "name",
    "permissions",
  ];
  Permission: any = ['Read', 'Write', 'Delete', 'Update']
  selectuserpermission: any[] = [];

  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  selection = new SelectionModel<any>(true, []);
  UserPermissionForm: FormGroup;
  rolelist: any = [{ id: 1, name: "Admin" },
  { id: 2, name: "OrganizationAdmin" },
  { id: 3, name: "DeviceOwner" },
  { id: 4, name: "Buyer" },
  { id: 5, name: "User" },
    //{id:6,name:""},
    // {id:,name:""}
  ]
  constructor(private authService: AuthbaseService, private deviceService: DeviceService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private toastrService: ToastrService,
    private aclpermissionServcie: ACLModulePermisionService) { }
  ngOnInit(

  ) {
    this.getaclmodulepermission();
    this.getuseraclmodulepermission();
    this.UserPermissionForm = this.formBuilder.group({
      aclmodulesId: [null],
      entityType: ["Role"],
      entityId: [[Validators.required]],
      permissions: [
        new FormControl([])
      ],
      status: 1,

    })
  }
  getaclmodulepermission() {
    this.aclpermissionServcie.getAcl_moduleList().subscribe({
      next: data => {
        this.datalist = data
        //this.dataSource = new MatTableDataSource(data);
      }, error: err => {

      }
    })

  }
  getuseraclmodulepermission() {
    this.aclpermissionServcie.getUserAcl_modulePermissionList().subscribe({
      next: data => {
        this.userdatalist = data
        //@ts-ignore
        this.userdatalist.forEach(ele => {
          if (ele.entityType === 'Role') {
            ele['user_role'] = this.rolelist.find((rolename: any) => rolename.id === ele.entityId,)?.name;

          }

        })
        console.log( this.userdatalist)
        this.dataSource = new MatTableDataSource( this.userdatalist);
      }, error: err => {

      }
    })

  }
  isAllSelected() {
    console.log("125")
    console.log(this.selection.selected);
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }
  masterToggle() {
    console.log("131")
    this.isAllSelected() ?
      this.selection.clear() :
      this.dataSource.data.forEach(row => this.selection.select(row));
  }
  // permissionchange(roeid,permissionvalue){

  // }
  onSubmit(): void {
    console.log(this.UserPermissionForm.value)
    //  if (this.selection.selected.length > 0) {
    let deviceId: any = []
    //   this.selection.selected.forEach((ele,i) => {
    // console.log(this.selectuserpermission[i]);
    // console.log(ele);
    // deviceId.push(ele.id)
    this.aclpermissionServcie.addUserACL_modulePermission(this.UserPermissionForm.value).subscribe({
      next: data => {
        if (data) {
          this.toastrService.success('SuccessFul')
          this.UserPermissionForm.reset();
          this.UserPermissionForm.controls['entityType'].setValue('Role');
          this.UserPermissionForm.controls['status'].setValue(1);
          this.getuseraclmodulepermission();
        }
      }, error: err => {
        this.toastrService.error('Fail', err.error.message)
      }
    })
    //   this.toastrService.error('Succsess', 'Validation Error!');
    //  })
    // 
    // } else {
    //   this.toastrService.error('Please select at least one device', 'Validation Error!');
    // }
  }
}