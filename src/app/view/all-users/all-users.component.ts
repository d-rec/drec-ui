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
  totalRows:number;
  totalPages:number=1;
  p:number=1;
  constructor(private authService: AuthbaseService, private adminService: AdminService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute) { }
  ngOnInit(): void {
    this.getAllUsers();
  }
  getAllUsers() {
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
}
