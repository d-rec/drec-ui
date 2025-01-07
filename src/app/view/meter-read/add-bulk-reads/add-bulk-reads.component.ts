import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import {
  AdminService,
  MeterReadService,
  OrganizationService,
} from '../../../auth/services';
import { OrganizationInformation } from '../../../models';
import { ToastrService } from 'ngx-toastr';

@Component({
  selector: 'app-add-bulk-reads',
  templateUrl: './add-bulk-reads.component.html',
})
export class AddBulkReadsComponent implements OnInit {
  currentFile?: File | null;
  progress = 0;
  message = '';
  fileName = 'Please click here to select file';
  pageSize: number = 10;
  loading: boolean = true;
  objectKeys = Object.keys;
  displayedColumns = [
    'serialNo',
    'createdAt',
    'jobId',
    'fileId',
    'status',
    'actions',
  ];
  displayedColumns1 = [
    'serialNo',
    'externalId',
    'errorsList',
    'Status',
    'Action',
  ];
  constructor(
    private adminService: AdminService,
    private orgService: OrganizationService,
    private toasterService: ToastrService,
    private readsService: MeterReadService,
  ) {
    this.loggedInUser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  dataSource1: MatTableDataSource<any>;
  data: any;
  orgList: any;
  filteredOrgList: OrganizationInformation[] = [];
  orgName: string;
  orgId: number;
  loggedInUser: any;

  ngOnInit(): void {
    if (this.loggedInUser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.orgList = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
        this.filteredOrgList = this.orgList;
      });
    } else if (this.loggedInUser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.orgList = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );
        this.filteredOrgList = this.orgList;
      });
    }
  }

  selectFile(event: any): void {
    if (event.target.files && event.target.files[0]) {
      const file: File = event.target.files[0];
      this.currentFile = file;
      this.fileName = this.currentFile.name;
      if (!this.fileName.endsWith('.csv')) {
        this.fileName = 'Invalid file';
        this.currentFile = null;
      }
    } else {
      this.fileName = 'Please click here to select file';
    }
    event.target.value = '';
  }

  filterOrgList() {
    this.filteredOrgList = this.orgList.filter(
      (org: OrganizationInformation) => {
        return org.name.toLowerCase().includes(this.orgName.toLowerCase());
      },
    );
  }
  selectOrg(event: any) {
    const selectedCountry = this.orgList.find(
      (option: any) => option.name === event.option.value,
    );
    if (selectedCountry) {
      this.orgId = selectedCountry.id;
    }
  }
  reset() {
    this.currentFile = null;
    this.fileName = 'Please click here to select file';
  }

  openFileExplorer() {
    document.getElementById('fileInput')?.click();
  }

  upload(): void {
    if (this.currentFile) {
      this.readsService.readsCSVUpload(this.currentFile).subscribe({
        next: () => {
          this.currentFile = null;
          this.fileName = 'Please click here to Select File';
          this.toasterService.success(
            'Successfully!',
            'Devices Uploaded in Bulk!!',
          );
        },
        error: (err) => {
          if (err.error.statusCode === 403) {
            this.toasterService.error('You are Unauthorized');
          } else {
            this.toasterService.error('error!', err.error.message);
          }
        },
      });
    }
  }
}
