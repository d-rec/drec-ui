import { FormBuilder, FormGroup } from '@angular/forms';
import { ChangeDetectorRef, Component, Inject, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { SelectionModel } from '@angular/cdk/collections';

import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AuthbaseService } from '../../../auth/authbase.service';
import { DeviceService, OrganizationService } from '../../../auth/services';
import { Router } from '@angular/router';
import { Observable, Subscription, debounceTime, forkJoin, of } from 'rxjs';
import { catchError, map, startWith } from 'rxjs/operators';
import {
  MatDialog,
  MatDialogRef,
  MatDialogModule,
  MAT_DIALOG_DATA,
} from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { DeviceDetailsComponent } from '../device-details/device-details.component';
import { ToastrService } from 'ngx-toastr';
import { fulecodeType, devicecodeType, CountryInfo } from '../../../models';
import { MapComponent, satellitePreview, SatellitePreview } from '../../map/map.component';
import { ChatService } from '../../../chat/chat.service';

@Component({
  standalone: false,
  selector: 'app-alldevices',
  templateUrl: './alldevices.component.html',
  styleUrls: ['./alldevices.component.scss'],
})
export class AlldevicesComponent {
  title = 'matDialog';
  dataFromDialog: any;
  displayedColumns = [
    'select',
    'index',
    'siteName',
    'externalId',
    'capacity',
    'countryCode',
    'reviewStatus',
    'evidentId',
    'evidentStatus',
    'commissioningDate',
    'onboarding_date',
    'actions',
  ];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  private _sort: MatSort;
  @ViewChild(MatSort) set sort(s: MatSort) {
    this._sort = s;
    if (this.dataSource) {
      this.dataSource.sort = s;
    }
  }
  @ViewChild(MapComponent) mapComponent: MapComponent;
  dataSource: MatTableDataSource<any>;
  data: any;
  searchText: string = '';
  satPreview: { preview: SatellitePreview; label: string; x: number; y: number } | null = null;
  satPreviewEnabled = false;
  loginuser: any;
  deviceurl: any;
  pageSize: number = 20;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
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
  orglist: any;
  orgname: string;
  orgId: number;
  filteredOrgList: Observable<any[]>;
  hideMap: boolean = false;
  hideFilterDevices: boolean = true;
  showResetMapFilter = false;
  selection = new SelectionModel<any>(true, []);
  bulkDeleting: boolean = false;
  reviewStatusFilters: Set<string> = new Set(['pending']);
  readonly reviewStatusOptions = [
    { key: 'pending', label: 'Pending', icon: '●' },
    { key: 'approved', label: 'Approved', icon: '✓' },
    { key: 'rejected', label: 'Rejected', icon: '✗' },
    { key: 'draft', label: 'Draft', icon: '✎' },
    { key: 'legacy', label: 'Legacy', icon: '◆' },
  ];
  constructor(
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private formBuilder: FormBuilder,
    private router: Router,
    private dialog: MatDialog,
    private orgService: OrganizationService,
    private toastrService: ToastrService,
    private changeDetectorRef: ChangeDetectorRef,
    private chatService: ChatService,
  ) {
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
    this.FilterForm = this.formBuilder.group({
      countryCode: [],
      countryname: [],
      fuelCode: [],
      deviceTypeCode: [],
      capacity: [],
      offTaker: [],
      SDGBenefits: [],
      start_date: [null],
      end_date: [null],
      //pagenumber: [this.p]
    });
  }
  ngOnInit(): void {
    if (this.loginuser.role === 'Registrant') {
      this.FilterForm.addControl(
        'organizationname',
        this.formBuilder.control(''),
      );
      this.FilterForm.addControl(
        'organizationId',
        this.formBuilder.control(''),
      );
      this.orgService.GetRegistrantAllOrganization().subscribe((data) => {
        this.orglist = data.organizations.filter(
          (org) => org.organizationType != 'Buyer',
        );
      });
    }
    this.authService.GetMethod('sdgbenefit/code').subscribe((data) => {
      this.sdgblist = data;
    });

    forkJoin({
      fuel: this.authService.GetMethod('device/fuel-type').pipe(catchError(() => of([]))),
      deviceType: this.authService.GetMethod('device/device-type').pipe(catchError(() => of([]))),
      country: this.authService.GetMethod('countrycode/list').pipe(catchError(() => of([]))),
    }).subscribe(({ fuel, deviceType, country }) => {
      this.fuellist = fuel as any;
      this.fuellistLoaded = true;
      this.devicetypelist = deviceType as any;
      this.devicetypeLoded = true;
      this.countrylist = country as any;
      this.countrycodeLoded = true;

      if (this.countrylist.length) {
        this.applycountryFilter();
      }
      if (this.loginuser.role === 'Registrant') {
        this.applyorgFilter();
      }
      this.loading = false;
      this.getDeviceListData(this.p);
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  applyorgFilter() {
    this.filteredOrgList = this.FilterForm.controls[
      'organizationname'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._orgfilter(value || '')),
    );
  }
  private _orgfilter(value: any): string[] {
    const filterValue = value.toLowerCase();
    return this.orglist.filter(
      (option: any) =>
        option.name.toLowerCase().indexOf(filterValue.toLowerCase()) === 0,
    );
  }
  applycountryFilter() {
    this.filteredOptions = this.FilterForm.controls[
      'countryname'
    ].valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value || '')),
    );
  }

  private _filter(value: any): CountryInfo[] {
    const filterValue = value.toLowerCase();
    if (
      !(
        this.countrylist.filter((option: any) =>
          option.country.toLowerCase().includes(filterValue),
        ).length > 0
      )
    ) {
      this.showerror = true;
    } else {
      this.showerror = false;
    }
    return this.countrylist.filter(
      (option: any) =>
        option.country.toLowerCase().indexOf(filterValue.toLowerCase()) === 0,
    );
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.searchText = filterValue;
    this.refreshFilter();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  clearSearch() {
    this.searchText = '';
    this.refreshFilter();
  }

  toggleReviewStatusFilter(key: string) {
    if (this.reviewStatusFilters.has(key)) {
      this.reviewStatusFilters.delete(key);
    } else {
      this.reviewStatusFilters.add(key);
    }
    this.refreshFilter();
  }

  private refreshFilter() {
    if (!this.dataSource) return;
    this.dataSource.filterPredicate = (row: any, filter: string) => {
      const { text, statuses } = JSON.parse(filter);
      if (statuses.length && !statuses.includes(row.reviewStatus)) {
        return false;
      }
      if (!text) return true;
      return Object.values(row)
        .map((v) => (v == null ? '' : String(v)).toLowerCase())
        .some((s) => s.includes(text));
    };
    this.dataSource.filter = JSON.stringify({
      text: this.searchText.trim().toLowerCase(),
      statuses: Array.from(this.reviewStatusFilters),
    });
  }

  checkFormValidity(): void {
    const isUserInteraction = true; // Flag to track user interaction

    this.FilterForm.valueChanges
      .pipe(
        debounceTime(500), // Debounce the stream for 500 milliseconds
      )
      .subscribe((formValues) => {
        if (isUserInteraction) {
          const countryValue = formValues.countryname;
          if (countryValue === undefined || countryValue === '') {
            this.FilterForm.controls['countryname'].setValue(null);
            this.FilterForm.controls['countryCode'].setValue(null);
          }
          const fuelCodeValue = formValues.fuelCode;
          if (fuelCodeValue === undefined) {
            this.FilterForm.controls['fuelCode'].setValue(null);
          }
          if (
            formValues.offTaker != null &&
            formValues.offTaker[0] === undefined
          ) {
            this.FilterForm.controls['offTaker'].setValue(null);
          }
          if (
            formValues.deviceTypeCode != null &&
            formValues.deviceTypeCode[0] === undefined
          ) {
            this.FilterForm.controls['deviceTypeCode'].setValue(null);
          }
          if (
            formValues.SDGBenefits != null &&
            formValues.SDGBenefits[0] === undefined
          ) {
            this.FilterForm.controls['SDGBenefits'].setValue(null);
          }
          // Other code...
        }
      });

    setTimeout(() => {
      const updatedFormValues = this.FilterForm.value;
      const isAllValuesNull = Object.values(updatedFormValues).some(
        (value) => !!value,
      );
      this.isAnyFieldFilled = isAllValuesNull;
      if (!this.isAnyFieldFilled) {
        this.getDeviceListData(this.p);
      }
    }, 500);

    // Other code...
  }
  selectorg(event: any) {
    this.subscription = this.filteredOrgList.subscribe((options) => {
      const selectedorg = options.find(
        (option) => option.name === event.option.value,
      );
      if (selectedorg) {
        this.FilterForm.controls['organizationId'].setValue(selectedorg.id);
      }
    });
  }
  selectCountry(event: any) {
    this.subscription = this.filteredOptions.subscribe((options) => {
      const selectedCountry = options.find(
        (option) => option.country === event.option.value,
      );
      if (selectedCountry) {
        this.FilterForm.controls['countryCode'].setValue(
          selectedCountry.alpha3,
        );
      }
    });
  }

  reset() {
    this.FilterForm.reset();
    this.FilterForm.controls['countryCode'].setValue(null);
    this.loading = false;
    this.isAnyFieldFilled = false;
    this.p = 1;
    this.getDeviceListData(this.p);
  }

  onEndChangeEvent(event: any) {
    this.endminDate = event;
  }

  DisplayListFilter() {
    this.p = 1;
    this.getDeviceListData(this.p);
  }

  getDeviceListData(page: number) {
    this.deviceurl = 'device/my?limit=10000&';

    this.deviceService
      .GetMyDevices(this.deviceurl, this.FilterForm.value, page)
      .subscribe({
        next: (data) => {
          this.showlist = true;

          if (data.devices) {
            this.loading = false;

            this.data = data;
            this.DisplayList();
          }
        },
        error: (err) => {
          console.log(err);
          if (err.error.statusCode === 403) {
            this.toastrService.error(
              "You don't have the permissions to access the devices.",
              'Access Denied',
            );
          } else {
            this.toastrService.error(
              err.error?.message || err.message || 'An unexpected error occurred',
              'Error',
            );
          }
          this.data = [];
          this.showlist = false;
        },
      });
  }

  DisplayList() {
    if (
      this.fuellistLoaded == true &&
      this.devicetypeLoded == true &&
      this.countrycodeLoded === true
    ) {
      this.data.devices.forEach((ele: any, idx: number) => {
        ele['_rowIndex'] = idx;
        ele['fuelname'] = this.fuellist.find(
          (fuelType) => fuelType.code === ele.fuelCode,
        )?.name;

        ele['devicetypename'] = this.devicetypelist.find(
          (devicetype) => devicetype.code == ele.deviceTypeCode,
        )?.name;

        ele['countryname'] = this.countrylist.find(
          (countrycode) => countrycode.alpha3 == ele.countryCode,
        )?.country;
      });

      this.dataSource = new MatTableDataSource(this.data.devices);
      this.totalRows = this.data.totalCount;
      this.totalPages = this.data.totalPages;
      // this.dataSource.paginator = this.paginator;
      this.dataSource.sortingDataAccessor = (row: any, key: string) => {
        if (key === 'index') return row._rowIndex;
        const v = row[key];
        return typeof v === 'string' ? v.toLowerCase() : v;
      };
      this.dataSource.sort = this._sort;
      this.refreshFilter();

      // Use setTimeout to ensure the map component is fully initialized
      setTimeout(() => {
        this.updateMapMarkers(this.data.devices);
      }, 300);
    }
  }
  UpdateDevice(row: any) {
    this.router.navigate(['/device/edit/' + row.serialNumber], {
      queryParams: { fromdevices: true },
    });
  }

  previousPage(): void {
    if (this.p > 1) {
      this.p--;
      this.getDeviceListData(this.p);
    }
  }

  nextPage(): void {
    if (this.p < this.totalPages) {
      this.p++;
      this.getDeviceListData(this.p);
    }
  }
  // showPrompt(deviceId:number): void {
  //   const dialogRef = this.dialog.open(DeviceDetailsComponent, {
  //     width: '500px',
  //     height: '400px',
  //   });

  //   dialogRef.afterClosed().subscribe((data) => {
  //     this.dataFromDialog = data.form;
  //     if (data.clicked === 'submit') {
  //     }
  //   });
  // }
  alertDialog(deviceId: number): void {
    this.dialog.open(DeviceDetailsComponent, {
      data: {
        deviceid: deviceId,
      },
      width: '900px',
      height: '70vh',
    });
  }

  openDialog(device: any) {
    const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Are you sure? This cannot be undone.',
        message:
          'Are you sure you want to delete device ' + device.serialNumber + '? This action cannot be undone.',
      },
    });
    confirmDialog.afterClosed().subscribe((result) => {
      if (result === true) {
        // this.employeeList = this.employeeList.filter(item => item.employeeId !== employeeObj.employeeId);
        this.deleteDevice(device.id);
      }
    });
  }

  deleteDevice(id: number) {
    this.deviceService.RemoveDevice(id).subscribe((response) => {
      if (response.success) {
        this.toastrService.success(response.message, 'Successfully');
        this.getDeviceListData(this.p);
      } else {
        this.toastrService.error(response.message, 'Failure');
      }
    });
  }

  isAllSelected(): boolean {
    if (!this.dataSource) return false;
    const rows = this.dataSource.filteredData;
    return rows.length > 0 && this.selection.selected.length === rows.length;
  }

  toggleAllRows(): void {
    if (!this.dataSource) return;
    if (this.isAllSelected()) {
      this.selection.clear();
    } else {
      this.dataSource.filteredData.forEach((row) => this.selection.select(row));
    }
  }

  bulkDeleteSelected(): void {
    if (this.bulkDeleting) return;
    const rows = this.selection.selected;
    if (!rows.length) return;
    const confirmDialog = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Delete ${rows.length} device${rows.length === 1 ? '' : 's'}?`,
        message: `This will permanently remove ${rows.length} selected device${rows.length === 1 ? '' : 's'}. This action cannot be undone.`,
      },
    });
    confirmDialog.afterClosed().subscribe((result) => {
      if (result !== true) return;
      this.bulkDeleting = true;
      const calls = rows.map((r) =>
        this.deviceService.RemoveDevice(r.id).pipe(
          map((resp) => ({ ok: !!resp?.success, id: r.id, msg: resp?.message })),
          catchError((err) => of({ ok: false, id: r.id, msg: err?.error?.message ?? err?.message ?? 'error' })),
        ),
      );
      forkJoin(calls).subscribe((results) => {
        this.bulkDeleting = false;
        const ok = results.filter((r: any) => r.ok).length;
        const failed = results.length - ok;
        if (ok > 0) {
          this.toastrService.success(`Deleted ${ok} device${ok === 1 ? '' : 's'}`, 'Bulk delete');
        }
        if (failed > 0) {
          this.toastrService.warning(
            `${failed} device${failed === 1 ? '' : 's'} could not be deleted (likely grouped or in-use)`,
            'Partial failure',
          );
        }
        this.selection.clear();
        this.getDeviceListData(this.p);
      });
    });
  }

  toggleMap() {
    this.hideMap = !this.hideMap;

    // If we're showing the map and we have data, reapply the markers
    if (!this.hideMap && this.data && this.data.devices) {
      // Use setTimeout to ensure the map component is fully initialized after toggling
      setTimeout(() => {
        this.updateMapMarkers(this.data.devices);
      }, 300);
    }
  }

  toggleFilterDevices() {
    this.hideFilterDevices = !this.hideFilterDevices;
  }

  updateMapMarkers(devices: any[]) {
    if (this.mapComponent && devices) {
      const validDevices = devices.filter(
        (device) =>
          device.latitude &&
          device.longitude &&
          !isNaN(parseFloat(device.latitude)) &&
          !isNaN(parseFloat(device.longitude)),
      );

      const markers = validDevices.map((device) => ({
        latitude: parseFloat(device.latitude),
        longitude: parseFloat(device.longitude),
        externalId: device.externalId || '',
        siteName: device.siteName || '',
        device,
      }));

      // Set the markers on the map component
      this.mapComponent.markers = [...markers];

      // If the map is already initialized, update it directly
      if (this.mapComponent.isMapInitialized) {
        this.mapComponent.update();
      }
    }
  }

  onMarkerClick(event: { externalId: string }) {
    this.showResetMapFilter = true;
    this.searchText = event.externalId;
    // Clear status filters so the single device is always visible regardless of its status
    this.reviewStatusFilters.clear();
    this.refreshFilter();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    this.changeDetectorRef.detectChanges();
  }

  openChat(device: any): void {
    const siteName = device.siteName || '';
    this.chatService.getAdminUser().subscribe({
      next: (admin) => {
        if (!admin?.email) return;
        this.chatService.siteName$.next(siteName);
        this.chatService.openForDevice$.next({
          submitterEmail: admin.email,
          siteName,
        });
        this.chatService.isChatOpen$.next(true);
      },
      error: (err) => {
        console.error('Could not get admin user for chat', err);
      },
    });
  }

  resetMapFilter() {
    this.searchText = '';
    this.reviewStatusFilters = new Set(['pending']);
    this.refreshFilter();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
    this.showResetMapFilter = false;
    this.changeDetectorRef.detectChanges();
  }

  showSatPreview(event: MouseEvent, row: any) {
    if (!this.satPreviewEnabled) return;
    const lat = parseFloat(row.latitude);
    const lng = parseFloat(row.longitude);
    if (isNaN(lat) || isNaN(lng)) return;
    const pos = this.satPreviewPos(event);
    this.satPreview = {
      preview: satellitePreview(lat, lng, 19),
      label: row.siteName || row.externalId || '',
      x: pos.x,
      y: pos.y,
    };
  }

  moveSatPreview(event: MouseEvent) {
    if (!this.satPreview) return;
    const pos = this.satPreviewPos(event);
    this.satPreview = { ...this.satPreview, x: pos.x, y: pos.y };
  }

  private satPreviewPos(event: MouseEvent): { x: number; y: number } {
    const boxW = 270;
    const boxH = 290;
    const gap = 16;
    const rightFits = event.clientX + gap + boxW < window.innerWidth;
    const x = rightFits ? event.clientX + gap : event.clientX - gap - boxW;
    const y = Math.min(Math.max(event.clientY - boxH / 2, 4), window.innerHeight - boxH - 4);
    return { x, y };
  }

  hideSatPreview() {
    this.satPreview = null;
  }
}

@Component({
  standalone: true,
  selector: 'deviceremove_dialog',
  templateUrl: 'deviceremove_dialog.html',
  imports: [MatDialogModule, MatButtonModule],
})
export class ConfirmDialogComponent {
  title: string;
  message: string;
  constructor(
    public dialogRef: MatDialogRef<ConfirmDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
  ) {}
}
