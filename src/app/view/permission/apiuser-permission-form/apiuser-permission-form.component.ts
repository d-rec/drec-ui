import { Component ,ViewChild} from '@angular/core';
import { FormBuilder, FormGroup, FormArray ,Validators} from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { DeviceService, ACLModulePermisionService } from '../../../auth/services';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatCheckboxChange } from "@angular/material/checkbox";
import { Router } from '@angular/router';
@Component({
  selector: 'app-apiuser-permission-form',
  templateUrl: './apiuser-permission-form.component.html',
  styleUrls: ['./apiuser-permission-form.component.scss']
})

export class ApiuserPermissionFormComponent {
  form: FormGroup;
  selection = new SelectionModel<any>(true, []);
  selectedModules: any[] = [];
  displayedColumns: string[] = ['select', 'name', 'permissions'];
  dataSource: MatTableDataSource<any>;
  
  constructor(private fb: FormBuilder,
    private toastrService: ToastrService,
    private aclpermissionServcie: ACLModulePermisionService,
    private router: Router) {


    this.form = this.fb.group({
     // client_id:[null, Validators.required],
     // client_secret:[null, Validators.required],
      permissions: this.fb.array([]),
    });
    //@ts-ignore
    this.dataSource = new MatTableDataSource<any>([]);
    this.aclpermissionServcie.getAcl_moduleList().subscribe({
      next: (data) => {
        const permissionFormArray = this.form.get('permissions') as FormArray;
        //@ts-ignore
        data.forEach(permission => {
          permission.selectedPermissions = []; // Initialize with empty strings
          permissionFormArray.push(this.createPermissionFormGroup(permission));

        });
        //@ts-ignore
        this.dataSource.data = this.form.get('permissions').value;
      },
      error: (err) => {
        // Handle the error
      },
    });
  }

  onRowSelect(row: any) {
    if (this.isSelected(row)) {
      this.selectedModules = this.selectedModules.filter((module) => module !== row);
    } else {
      this.selectedModules.push(row);
    }
  }

  isSelected(row: any): boolean {
   
    return this.selectedModules.includes(row);
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

  clearSelectedModules() {
    this.selectedModules = [];
  }

  submitPermissions() {
  
    if (this.selection.selected.length > 0) {

      let permissionrequest: any = []
      this.selection.selected.forEach(ele => {
        if (ele.selectedPermissions.length === 0){
          permissionrequest=[];
        }else{
          permissionrequest.push({
            "aclmodulesId": ele.id,
            "permissions":ele.selectedPermissions
          })
        }
       
      })
      if(permissionrequest.length===0){
        this.toastrService.warning('Warning','In selected module also need to select permission')
      }else{
   //, this.form.value.client_id, this.form.value.client_secret
        this.aclpermissionServcie.ApiUserPermissionRequest(permissionrequest).subscribe({
          next:data=>{
          
            this.form.reset();
            this.selection.clear();
            this.toastrService.success('Successful','Request Sent')
            this.router.navigate(['/apiuser/permission/list']);
          },error:err=>{
            this.toastrService.error('Error:'+err.error.message,'Request Fail')
          }
  
        })
      }
    
    
    } else {
      this.toastrService.error('Please select at least one module permission', 'Validation Error!');
    }
  }

  createPermissionFormGroup(permission: any): FormGroup {
    const group = this.fb.group({
      id: [permission.id],
      name: [permission.name],
      permissions: [permission.permissions],
      selectedPermissions: this.fb.array(permission.selectedPermissions) // Initialize as all false
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
  // getSelectedPermissions(module: any): string {
  //   return module.permissions
  //     //@ts-ignore
  //     .filter((_, i) => module.selectedPermissions[i])
  //     .join(', ');
  // }

  // getPermissionControls(permissions: string[]): { [key: string]: any } {
  //   const permissionControls = {};
  //   permissions.forEach(permission => {
  //     //@ts-ignore
  //     permissionControls[permission] = false;
  //   });
  //   return permissionControls;
  // }
}
