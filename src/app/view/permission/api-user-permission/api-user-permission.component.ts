import { FormBuilder, FormGroup, Validators, FormControl, ReactiveFormsModule, FormsModule, } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MediaMatcher } from '@angular/cdk/layout';
import { Component, OnInit, Inject, ViewChild, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
// import { NavItem } from './nav-item';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuthbaseService } from '../../../auth/authbase.service';
import { AdminService, OrganizationService, ACLModulePermisionService, UserService } from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog, MatDialogRef, MatDialogModule, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ToastrService } from 'ngx-toastr';
import { errors } from 'ethers';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CommonModule } from '@angular/common';
import {EditPermissionComponent} from '../edit-permission/edit-permission.component';
import { getapiuser_header } from '../../../utils/apiuser_clientinfo'
@Component({
  selector: 'app-api-user-permission',
  templateUrl: './api-user-permission.component.html',
  styleUrls: ['./api-user-permission.component.scss']
})
export class ApiUserPermissionComponent {
  FilterForm: FormGroup;
  displayedColumns = [
    'module_name',
    'permission',
    'status',
    'Action'

  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  data: any;
  showlist: boolean = false;
  loading: boolean = false;
  totalRows: number;
  totalPages: number = 1;
  p: number = 1;
  userId: number;
  showorg: boolean = false;
  showuserdetails: boolean;
  userdetails: any
  loginuser: any;
  apiuserlist: any;
  showgoback: boolean = false;
  filteredOptions: Observable<any[]>;
  subscription: Subscription;
  showerror: boolean = false;
  permission_status: string;
  fromselectid: boolean = false;
  client_id: string;
  client_secret: string;
  form: FormGroup;
  showclientform: boolean = true
  constructor(private userService: UserService,
    private orgService: OrganizationService,
    private adminService: AdminService,
    private userpermissionService: ACLModulePermisionService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute,
    private toastrService: ToastrService) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    if (this.activatedRoute.snapshot.params['id']) {
      this.userId = this.activatedRoute.snapshot.params['id'];
      this.showgoback = true;
      this.showuserdetails = true;
      this.getuserinfo();

    } else if (this.loginuser.role === 'ApiUser') {
     this.getapiUser();
    }
    else {
      this.showuserdetails = false;
    }
  }
  ngOnInit() {

    this.form = this.formBuilder.group({
      client_id: [null, Validators.required],
      client_secret: [null, Validators.required],
    });
    this.FilterForm = this.formBuilder.group({
      user_id: [this.userId],
      organizationName: [this.userId],

      //pagenumber: [this.p]
    });

    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllApiUsers().subscribe(
        (data) => {
          this.apiuserlist = data.users;
        })
    }

    // setTimeout(() => {
    //   // if (this.countrycodeLoded) {
    //   this.applyorgFilter();
    //   // }
    //   this.loading = false;
    //   //this.getAllUserspermission(this.p);
    // }, 2000)

  }
  async getapiUser(){
    this.userId = this.loginuser.id;
    this.showuserdetails = true;
   // let headers:any = await getapiuser_header();
    this.userService.userProfile().subscribe({
      next: data1 => {
        this.showclientform = false;
        this.userdetails = data1
        this.permission_status = data1.permission_status
        this.getAllUserspermission();
      }
    })
  }
  getuserinfo() {

    this.userService.getuserById(this.userId).subscribe({
      next: data1 => {
        this.userdetails = data1
        this.permission_status = data1.permission_status
        this.getAllUserspermission();
      }
    })
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  applyorgFilter() {
    this.FilterForm.controls['organizationName'];
    this.filteredOptions = this.FilterForm.controls['organizationName'].valueChanges.pipe(
      startWith(''),
      map(value => this._filter(value || '')),
    );
  }

  private _filter(value: any): string[] {

    const filterValue = value.toLowerCase();
    if (!(this.apiuserlist.filter((option: any) => option.firstName.toLowerCase().includes(filterValue)).length > 0)) {
      this.showerror = true;
      // const updatedFormValues = this.FilterForm.value;
      // const isAllValuesNull = Object.values(this.FilterForm.value).some((value) => !!value);
      // this.isAnyFieldFilled = false;
    } else {
      this.showerror = false;
    }
    return this.apiuserlist.filter((option: any) => option.firstName.toLowerCase().indexOf(filterValue.toLowerCase()) === 0);

  }
  selectOrg(event: any) {
    // this.subscription = this.filteredOptions.subscribe(options => {
    //   const selectedorg = options.find(option => option.id === event.option.value);
    //   if (selectedorg) {
    this.fromselectid = true;
    //     this.FilterForm.controls['user_id'].setValue(selectedorg.id);
    //     this.FilterForm.controls['organizationName'].setValue(selectedorg.firstName);
    //   }
    // });
  }
  reset() {
    this.FilterForm.reset();

    this.FilterForm.controls['organizationName'].setValue(null);
    this.FilterForm.controls['user_id'].setValue(null);
    // this.loading = true;
    // this.applyorgFilter();
    this.showlist = false;
    // this.getAllUserspermission(this.p);
  }
  submit() {

    this.userId = this.loginuser.id;
    this.showuserdetails = true;
    this.userService.userProfile().subscribe({
      next: data1 => {
    
        this.showclientform = false;
        this.userdetails = data1
        this.permission_status = data1.permission_status
        this.getAllUserspermission();
      }
    })
  }
  getAllUserspermission() {
    const limit = 20;
    this.loading = true
    if (this.loginuser.role === "Admin") {
     
      this.userpermissionService.getUserpermission(this.FilterForm.value).subscribe((data) => {
      
        this.loading = false
        if (data.length > 0) {
          this.showorg = true;

          this.showlist = true

          //@ts-ignore
          this.data = data;//.filter(ele => ele.organizationType === 'Developer');
        
          this.dataSource = new MatTableDataSource(this.data);
          this.totalRows = this.data.totalCount
        
          this.totalPages = this.data.totalPages
        }

      })


    } else if (this.loginuser.role === "ApiUser") {
     
      const data = {
        user_id: this.userId
      }
      this.userpermissionService.getUserpermission(data).subscribe((data) => {
      
        this.loading = false
        if (data.length > 0) {
          //this.showorg = true;

          this.showlist = true

          //@ts-ignore
          this.data = data;//.filter(ele => ele.organizationType === 'Developer');
         
          this.dataSource = new MatTableDataSource(this.data);
          this.totalRows = this.data.totalCount
       
          this.totalPages = this.data.totalPages
        }

      })

    }
  }

  openupdate_permission_Dialog() {
    const confirmDialog = this.dialog.open(PermissionUpdateComponent, {
      data: {
        title: 'Apiuser Permission Verification of ' + this.userdetails.firstName + ' ' + this.userdetails.lastName,
        message: 'Are you sure, you want to  give permission: ',
        userinfo: this.userdetails
      }
    });
    confirmDialog.afterClosed().subscribe(result => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        //this.deleteDevice(device.id)
        this.getuserinfo();
      }
    });
  }

  UpdatePermission(row:number){
   
    const dialogRef = this.dialog.open(EditPermissionComponent, {
      data: {
        upatefor: 'User ',
        permission: row
      },
      width: '700px',
      height: '300px',
    });
    dialogRef.afterClosed().subscribe(result => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
      //  this.getuseraclmodulepermission();
      }
    });
  
}
}

@Component({
  selector: 'permission_updatefprm',
  templateUrl: 'permission_updatefprm.html',
  standalone: true,
  imports: [MatDialogModule, MatButtonModule, MatCardModule, ReactiveFormsModule,
    MatFormFieldModule, FormsModule, MatInputModule, MatSelectModule, CommonModule],
})
export class PermissionUpdateComponent {
  title: string;
  message: string;
  permistion_updateForm: FormGroup;
  Permissionstatus: any = [ 'Active', 'Inactive']
  api_userId: string;
  constructor(public dialogRef: MatDialogRef<PermissionUpdateComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private fb: FormBuilder,
    private toastrService: ToastrService, private aclmoduleService: ACLModulePermisionService) { }
  ngOnInit() {
    this.api_userId = this.data.userinfo.api_user_id;
    this.permistion_updateForm = this.fb.group({
      // api_user_id: [this.data.userinfo.api_user_id],
      status: [this.data.userinfo.permission_status],
    });
  }

  onSubmit() {
   
    this.aclmoduleService.updateUserpermissionByAdmin(this.api_userId, this.permistion_updateForm.value).subscribe({
      next: data => {
        if (data) {

          this.toastrService.success('permission update Successfull')
        }
      }, error: err => {
        this.toastrService.error('Fail', err.error.message)
      }
    })

  }
}
