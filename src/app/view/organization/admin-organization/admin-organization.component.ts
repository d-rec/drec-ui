import { FormBuilder, FormGroup } from '@angular/forms';
import { Component, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AuthbaseService } from '../../../auth/authbase.service';
import { AdminService, OrganizationService } from '../../../auth/services';
import { Router, ActivatedRoute } from '@angular/router';
import { Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import {
  OrganizationInformation,
  fulecodeType,
  devicecodeType,
  CountryInfo,
} from '../../../models';
@Component({
  selector: 'app-admin-organization',
  templateUrl: './admin-organization.component.html',
  styleUrls: ['./admin-organization.component.scss'],
})
export class AdminOrganizationComponent {
  title = 'matDialog';
  dataFromDialog: any;
  displayedColumns = ['name', 'type', 'status', 'no of users', 'actions'];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  data: any;
  loginuser: any;
  deviceurl: any;
  pageSize: number = 20;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  orglist: OrganizationInformation[] = [];
  devicetypelist: devicecodeType[] = [];
  fuellistLoaded: boolean = false;
  devicetypeLoded: boolean = false;
  countrycodeLoded: boolean = false;
  loading: boolean = true;
  public sdgblist: any;
  FilterForm: FormGroup;
  p: number = 1;
  totalRows = 0;
  filteredOptions: Observable<any[]>;
  offtaker = [
    'School',
    'Education',
    'Health Facility',
    'Residential',
    'Commercial',
    'Industrial',
    'Public Sector',
    'Agriculture',
    'Utility',
    'Off-Grid Community',
  ];
  endminDate = new Date();
  totalPages: number;
  subscription: Subscription;
  selectedCountry: any;
  isAnyFieldFilled: boolean = false;
  showerror: boolean = false;
  showlist: boolean = false;
  orglistload: boolean = false;
  constructor(
    private authService: AuthbaseService,
    private adminService: AdminService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private activatedRoute: ActivatedRoute,
    private orgService: OrganizationService,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.activatedRoute.queryParams.subscribe(() => {});

    this.FilterForm = this.formBuilder.group({
      organizationName: [],
    });
  }
  ngOnInit() {
    if (this.loginuser.role === 'Admin') {
      this.adminService.GetAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org: OrganizationInformation) => org.organizationType != 'ApiUser',
        );
        this.orglistload = true;
      });
    } else if (this.loginuser.role === 'ApiUser') {
      this.orgService.GetApiUserAllOrganization().subscribe((data) => {
        this.orglist = data.organizations;
        this.orglistload = true;
      });
    }

    setTimeout(() => {
      this.loading = false;
      if (this.loginuser.role === 'Admin') {
        this.getAllOrganization(this.p);
      } else if (this.loginuser.role === 'ApiUser') {
        this.getApiuserAllOrganization(this.p);
      }
      if (this.orglistload) {
        this.applyorgFilter();
      }
    }, 2500);
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  applyorgFilter() {
    this.FilterForm.controls['organizationName'];
    this.filteredOptions = this.FilterForm.controls[
      'organizationName'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '')),
    );
  }

  private _filter(value: any): OrganizationInformation[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.orglist.filter((option: OrganizationInformation) =>
          option.name.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showerror = true;
    } else {
      this.showerror = false;
    }
    return this.orglist.filter(
      (option: OrganizationInformation) =>
        option.name.toLowerCase().indexOf(filterValue.toLowerCase()) === 0,
    );
  }

  selectOrg(event: any) {
    this.subscription = this.filteredOptions.subscribe((options) => {
      const selectedorg = options.find(
        (option) => option.name === event.option.value,
      );
      if (selectedorg) {
        this.FilterForm.controls['organizationName'].setValue(selectedorg.name);
      }
    });
  }
  reset() {
    this.FilterForm.reset();
    this.p = 1;
    this.loading = true;
    if (this.loginuser.role === 'Admin') {
      this.getAllOrganization(this.p);
    }
    if (this.loginuser.role === 'ApiUser') {
      this.getApiuserAllOrganization(this.p);
    }
  }
  getAllOrganization(page: number) {
    const limit = 20;
    this.adminService
      .GetAllOrganization(page, limit, this.FilterForm.value)
      .subscribe(
        (data) => {
          this.showlist = true;
          this.loading = false;
          this.data = data;
          this.dataSource = new MatTableDataSource(
            this.data.organizations.filter(
              (org: OrganizationInformation) =>
                org.organizationType != 'ApiUser',
            ),
          );
          this.totalRows = this.data.totalCount;
          this.totalPages = this.data.totalPages;
          this.dataSource.sort = this.sort;
        },
        (error) => {
          if (error) {
            this.data = [];
            this.showlist = false;
          }
        },
      );
  }
  getApiuserAllOrganization(page: number) {
    const limit = 20;
    this.orgService
      .GetApiUserAllOrganization(page, limit, this.FilterForm.value)
      .subscribe(
        (data) => {
          this.showlist = true;
          this.loading = false;
          this.data = data;
          this.dataSource = new MatTableDataSource(this.data.organizations);
          this.totalRows = this.data.totalCount;
          this.totalPages = this.data.totalPages;
          this.dataSource.sort = this.sort;
        },
        (error) => {
          if (error) {
            this.data = [];
            this.showlist = false;
          }
        },
      );
  }
  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      if (this.loginuser.role === 'Admin') {
        this.getAllOrganization(this.p);
      }
      if (this.loginuser.role === 'ApiUser') {
        this.getApiuserAllOrganization(this.p);
      }
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      if (this.loginuser.role === 'Admin') {
        this.getAllOrganization(this.p);
      }
      if (this.loginuser.role === 'ApiUser') {
        this.getApiuserAllOrganization(this.p);
      }
    }
  }
}
