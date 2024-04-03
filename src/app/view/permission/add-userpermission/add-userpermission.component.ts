import { Component, Inject, ViewChild } from '@angular/core';
import { SelectionModel } from '@angular/cdk/collections';
import { FormBuilder, FormGroup, FormArray, FormControl, Validators } from '@angular/forms';
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
import { EditPermissionComponent } from '../edit-permission/edit-permission.component'
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
    "Action"
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
  dataSource1: MatTableDataSource<any>;
  selection = new SelectionModel<any>(true, []);
  UserPermissionForm: FormGroup;
  rolelist: any = [{ id: 1, name: "Admin" },
  { id: 2, name: "OrganizationAdmin" },
  { id: 3, name: "DeviceOwner" },
  { id: 4, name: "Buyer" },
  { id: 5, name: "User" },
  { id: 6, name: "SubBuyer" },
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
    //  this.getaclmodulepermission();
    this.getuseraclmodulepermission();
    this.UserPermissionForm = this.formBuilder.group({
      // aclmodulesId: [null],
      entityType: ["Role"],
      entityId: [[Validators.required]],
      // permissions: [
      //   new FormControl([])
      // ],
      // status: 1,
      permissions: this.formBuilder.array([]),

    })

    //@ts-ignore
    this.dataSource1 = new MatTableDataSource<any>([]);
    this.aclpermissionServcie.getAcl_moduleList().subscribe({
      next: (data) => {
        const permissionFormArray = this.UserPermissionForm.get('permissions') as FormArray;
        //@ts-ignore
        data.forEach(permission => {
          permission.selectedPermissions = []; // Initialize with empty strings
          permissionFormArray.push(this.createPermissionFormGroup(permission));

        });
        //@ts-ignore
        this.dataSource1.data = this.UserPermissionForm.get('permissions').value;
      },
      error: (err) => {
        // Handle the error
      },
    });
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
        this.userdatalist = data.filter(permission => permission.entityType != "User");
        //@ts-ignore
        this.userdatalist.forEach(ele => {
          if (ele.entityType === 'Role') {
            ele['user_role'] = this.rolelist.find((rolename: any) => rolename.id === ele.entityId,)?.name;

          }

        })
        this.dataSource = new MatTableDataSource(this.userdatalist);
      }, error: err => {

      }
    })

  }
  isAllSelected() {
    const numSelected = this.selection.selected.length;
    const numRows = this.dataSource.data.length;
    return numSelected === numRows;
  }
  masterToggle() {
    this.isAllSelected() ?
      this.selection.clear() :
      this.dataSource.data.forEach(row => this.selection.select(row));
  }
  // permissionchange(roeid,permissionvalue){

  // }

  createPermissionFormGroup(permission: any): FormGroup {
    const group = this.formBuilder.group({
      id: [permission.id],
      name: [permission.name],
      permissions: [permission.permissions],
      selectedPermissions: this.formBuilder.array(permission.selectedPermissions) // Initialize as all false
    });
    return group;
  }
  togglePermission(module: any, permission: string): void {
    const index = module.selectedPermissions.indexOf(permission);
    if (index === -1) {
      module.selectedPermissions.push(permission);
    } else {
      module.selectedPermissions.splice(index, 1);
    }
  }
  onSubmit(): void {
    //  if (this.selection.selected.length > 0) {
    let deviceId: any = []
    //   this.selection.selected.forEach((ele,i) => {
    // deviceId.push(ele.id)
    if (this.selection.selected.length > 0) {
      this.selection.selected.forEach((ele: any, index: number)=> {

        const request = {

          "aclmodulesId": ele.id,
          "entityType": this.UserPermissionForm.value.entityType,
          "entityId": this.UserPermissionForm.value.entityId,
          "permissions": ele.selectedPermissions,
          "status": 1

        }
        this.aclpermissionServcie.addUserACL_modulePermission(request).subscribe({
          next: data => {
            if (data) {
            
              const index = this.selection.selected.indexOf(ele);
              this.selection.selected.splice(index, 1);
           
              // Check if formDataArray is empty
              if (this.selection.selected.length === 0) {
              this.UserPermissionForm.reset();
              this.selection.clear();
              this.toastrService.success('SuccessFul')
              this.UserPermissionForm.controls['entityType'].setValue('Role');
             // this.UserPermissionForm.controls['status'].setValue(1);
              this.getuseraclmodulepermission();
              }
              
            }
          }, error: err => {
            this.toastrService.error('Fail', err.error.message)
          }
        })
      })

    } else {
      this.toastrService.error('Please select at least one module permission', 'Validation Error!');
    }
    //   this.toastrService.error('Succsess', 'Validation Error!');
    //  })
    // 
    // } else {
    //   this.toastrService.error('Please select at least one device', 'Validation Error!');
    // }
  }
  UpdatePermission(row: number) {

    const dialogRef = this.dialog.open(EditPermissionComponent, {
      data: {
        upatefor: 'Role',
        permission: row
      },
      width: '700px',
      height: '300px',
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        this.getuseraclmodulepermission();
      }
    });

  }
}
