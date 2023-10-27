import { Component } from '@angular/core';
import { FormBuilder, FormGroup, FormArray } from '@angular/forms';
import { ToastrService } from 'ngx-toastr';
import { DeviceService, ACLModulePermisionService } from '../../../auth/services';
import { SelectionModel } from '@angular/cdk/collections';
import { MatTableDataSource } from '@angular/material/table';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatCheckboxChange } from "@angular/material/checkbox";
@Component({
  selector: 'app-apiuser-permission-form',
  templateUrl: './apiuser-permission-form.component.html',
  styleUrls: ['./apiuser-permission-form.component.scss']
})
export class ApiuserPermissionFormComponent {
  form: FormGroup;
  modules = [
    { id: 1, moduleName: 'First Module' },
    { id: 2, moduleName: 'Second Module' },
    // Add more modules as needed
  ];
  datalist: any;
  selection = new SelectionModel<any>(true, []);
  dataSource = new MatTableDataSource<any>()
  displayedColumns: string[] = ['selectAll','name', 'permissions'];
  selectedPermissions: any[] = [];
  selectAll: { [moduleId: number]: boolean } = {};

  constructor(private fb: FormBuilder, private toastrService: ToastrService,
    private aclpermissionServcie: ACLModulePermisionService) {

  }

  ngOnInit() {

    this.getAclModulePermission();
  }

  // getaclmodulepermission() {
  //   this.aclpermissionServcie.getAcl_moduleList().subscribe({
  //     next: data => {
  //       this.datalist = data


  //       this.dataSource = new MatTableDataSource(this.datalist);
       
  //     }, error: err => {

  //     }
  //   })

  // }


  // addRow() {
  //   const newRow = this.fb.group({
  //     moduleId: [],
  //     permissions:this.fb.array([])
  //   });

  //   this.rows.push(newRow);
  // }
  getAclModulePermission() {
    this.aclpermissionServcie.getAcl_moduleList().subscribe({
      next: (data) => {
        this.datalist = data
        this.dataSource = new MatTableDataSource(this.datalist);
       // this.populateRows(data.length);
      },
      error: (err) => {
        // Handle the error
      },
    });
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

  // toggleSelection(row: any, permission: string) {
  //   // Implement the logic to toggle checkbox state for the selected permission
  //   row.selectedPermissions[permission] = !row.selectedPermissions[permission];
  // }

  // Fetch your API data and initialize selectedPermissions and selectAll here

  toggleSelectAll() {
    for (const moduleId in this.selectAll) {
      if (this.selectAll[moduleId]) {
        for (const permission in this.selectedPermissions[moduleId]) {
          this.selectedPermissions[moduleId][permission] = true;
        }
      } else {
        for (const permission in this.selectedPermissions[moduleId]) {
          this.selectedPermissions[moduleId][permission] = false;
        }
      }
    }
  }
  // onChange(selectedOption: MatCheckboxChange,i) {
  //   const interests = (<FormArray>(
  //     this.form.rows.get("interests")
  //   )) as FormArray;

  //   if (selectedOption.checked) {
  //     interests.push(new FormControl(selectedOption.source.value));
  //   } else {
  //     const i = interests.controls.findIndex(
  //       x => x.value === selectedOption.source.value
  //     );
  //     interests.removeAt(i);
  //   }
  // }
  onSubmit(): void {
    
    console.log(this.selection.selected)
    if (this.selection.selected.length > 0) {

      // let deviceId: any = []
      this.selection.selected.forEach((ele,index) => {
        console.log(this.selectedPermissions[index])
      })
      // this.form.controls['deviceIds'].setValue(deviceId)
      // console.log(this.form);
    
    } else {
      this.toastrService.error('Please select at least one device', 'Validation Error!');
    }
  }

//   selection = new SelectionModel<any>(true, []);
//   formGroups: FormGroup[] = [];
//   apiResponse: any[]; // Replace with your API response
//   displayedColumns: string[] = ['select','name', 'permissions'];
//   constructor(private fb: FormBuilder, private toastrService: ToastrService,
//       private aclpermissionServcie: ACLModulePermisionService) {
//         this.aclpermissionServcie.getAcl_moduleList().subscribe({
//               next: (data) => {
//                 this.apiResponse = data
//                // this.dataSource = new MatTableDataSource(this.datalist);
//                // this.populateRows(data.length);
//               },
//               error: (err) => {
//                 // Handle the error
//               },
//             });
//       }

//   ngOnInit(): void {
//     // Initialize FormArray with FormGroups based on the API response
//     if (this.apiResponse && this.apiResponse.length > 0) {
//       this.apiResponse.forEach((item) => {
//         const formGroup = this.fb.group({});
//         // Add specific fields from your API response to the form group
//         formGroup.addControl('name', this.fb.control(item.name));
//        // formGroup.addControl('description', this.fb.control(item.description));
//         // Add a new FormControl for checkbox
//         formGroup.addControl('permissions', this.fb.control(false));
//         this.formGroups.push(formGroup);
//       });
//     }
//   }
//  isAllSelected() {
//     console.log("125")
//     console.log(this.selection.selected);
//     const numSelected = this.selection.selected.length;
//     const numRows =this.formGroups.length;
//     return numSelected === numRows;
//   }
//   masterToggle() {
//     console.log("131")
//     this.isAllSelected() ?
//       this.selection.clear() :
//       this.formGroups.forEach(row => this.selection.select(row));
//   }
//   onSubmit() {
//     // Handle form submission here
//     //const selectedItems = this.formGroups.value.filter((item) => item.selected);
//     //console.log(selectedItems);
//   }
}
