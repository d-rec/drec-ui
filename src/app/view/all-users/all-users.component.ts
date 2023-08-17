import { FormBuilder, FormGroup, FormControl } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MediaMatcher } from '@angular/cdk/layout';
import { Component, OnInit, ViewChild, ViewChildren, QueryList, ChangeDetectorRef } from '@angular/core';
// import { NavItem } from './nav-item';
import { MatTableDataSource, MatTable } from '@angular/material/table';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { MatSort } from '@angular/material/sort';
import { MatPaginator, PageEvent } from '@angular/material/paginator';
import { AuthbaseService } from '../../auth/authbase.service';
import { AdminService } from '../../auth/services/admin.service';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subscription, debounceTime } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { ConfirmDialogComponent } from '../confirm-dialog/confirm-dialog.component'
import {EditUserComponent} from '../edit-user/edit-user.component';
import { ToastrService } from 'ngx-toastr';
import { errors } from 'ethers';
@Component({
  selector: 'app-all-users',
  templateUrl: './all-users.component.html',
  styleUrls: ['./all-users.component.scss']
})
export class AllUsersComponent {
  displayedColumns = [
    'name',
    'orgemail',
    'type',
    'status',
    'actions',
  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  data: any;
  showlist: boolean = false;
  loading: boolean = true;
  totalRows: number;
  totalPages: number = 1;
  p: number = 1;
  orgnaizatioId:number;
  constructor(private authService: AuthbaseService, private adminService: AdminService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute,
    private toastrService: ToastrService) {
      if(this.activatedRoute.snapshot.params['id']){
        this.orgnaizatioId = this.activatedRoute.snapshot.params['id'];
      }
     }
  ngOnInit(): void {
    this.getAllUsers();
  }
  getAllUsers() {
    if(this.orgnaizatioId!=null||this.orgnaizatioId!=undefined){
      this.adminService.GetAllOrgnaizationUsers(this.orgnaizatioId).subscribe((data) => {
        console.log(data)
        this.showlist = true
        this.loading = false
        //@ts-ignore
        this.data = data;//.filter(ele => ele.organizationType === 'Developer');
        console.log(this.data);
        this.dataSource = new MatTableDataSource(this.data);
        this.totalRows = this.data.totalCount
        console.log(this.totalRows);
        this.totalPages = this.data.totalPages
      })
    }else{
      this.adminService.GetAllUsers().subscribe((data) => {
        console.log(data)
        this.showlist = true
        this.loading = false
        //@ts-ignore
        this.data = data;//.filter(ele => ele.organizationType === 'Developer');
        console.log(this.data);
        this.dataSource = new MatTableDataSource(this.data);
        this.totalRows = this.data.totalCount
        console.log(this.totalRows);
        this.totalPages = this.data.totalPages
      })
    }
   
  }
  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.getAllUsers();
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.getAllUsers();;
    }
  }
  openUpdateDialog(user: any) {

    //this.router.navigate(['/admin/edit_user/' + user.id]);
    const confirmDialog = this.dialog.open(EditUserComponent, {
      data: {
        title: 'Edit User',
        //message: 'Are you sure, you want to remove Uaer: ' + user.firstName+ '' +user.lastName
        userinfo: user
      },
      width: '900px',
      height: '300px',
    });
    confirmDialog.afterClosed().subscribe(result => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        this.getAllUsers()
      }
    });
  }

  openDialog(user: any) {
    const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Confirm Remove User',
        message: 'Are you sure, you want to remove User: ' + user.firstName + '' + user.lastName
      }
    });
    confirmDialog.afterClosed().subscribe(result => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        this.deleteUser(user.id)
      }
    });
  }
  deleteUser(id: number) {
  
      this.adminService.removeUser(id).subscribe((response) => {
        console.log(response);
        if (response.success) {
          this.toastrService.success(response.message, 'Successfully')
          this.getAllUsers();
        } else {
  
          this.toastrService.error(response.message, 'Failure')
        }
  
      },(err) =>{
        console.log(err)
        this.toastrService.error(err.error.message, 'Failure')
      })
  
    
  }
}
