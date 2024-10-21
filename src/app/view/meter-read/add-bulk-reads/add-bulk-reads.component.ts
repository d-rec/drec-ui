import { Component, OnInit, ViewChild } from '@angular/core';
import { Observable } from 'rxjs';
import { FileuploadService } from '../../../auth/services/fileupload.service';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AdminService, OrganizationService } from '../../../auth/services';
import { OrganizationInformation } from '../../../models';

@Component({
  selector: 'app-add-bulk-reads',
  templateUrl: './add-bulk-reads.component.html',
})
export class AddBulkReadsComponent implements OnInit {
  currentFile?: File | null;
  progress = 0;
  message = '';
  pageSize: number = 10;
  loading: boolean = true;
  objectKeys = Object.keys;
  displayedColumns = [
    'serialno',
    'createdAt',
    'jobId',
    'fileId',
    'status',
    'actions',
  ];
  displayedColumns1 = [
    'serialno',
    'externalId',
    'errorsList',
    'Status',
    'Action',
  ];
  constructor(
    private uploadService: FileuploadService,
    private adminService: AdminService,
    private orgService: OrganizationService,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  dataSource1: MatTableDataSource<any>;
  data: any;
  orglist: any;
  filteredOrgList: OrganizationInformation[] = [];
  orgname: string;
  orgId: number;
  loginuser: any;

  ngOnInit(): void {
    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType !== 'Buyer',
        );
        this.filteredOrgList = this.orglist;
      });
    } else if (this.loginuser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );
        this.filteredOrgList = this.orglist;
      });
    }
  }

  filterOrgList() {
    this.filteredOrgList = this.orglist.filter(
      (org: OrganizationInformation) => {
        return org.name.toLowerCase().includes(this.orgname.toLowerCase());
      },
    );
  }
  selectOrg(event: any) {
    const selectedCountry = this.orglist.find(
      (option: any) => option.name === event.option.value,
    );
    if (selectedCountry) {
      this.orgId = selectedCountry.id;
    }
  }
  reset() {
    this.currentFile = null;
 
  }


  openFileExplorer() {
    document.getElementById('fileInput')?.click();
  }

  upload(): void {
    this.progress = 0;
    this.message = '';
  }
}
