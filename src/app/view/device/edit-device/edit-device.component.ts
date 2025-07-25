import { Component, OnInit, ViewChild } from '@angular/core';
import {
  FormGroup,
  FormBuilder,
  Validators,
  FormControl,
} from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { DeviceService } from '../../../auth/services/device.service';
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { CountryInfo, fulecodeType, devicecodeType } from '../../../models';
import { postcodeValidator } from '../../../utils/validate-postcode';
import { MapComponent } from '../../map/map.component';

@Component({
  selector: 'app-edit-device',
  templateUrl: './edit-device.component.html',
  styleUrls: ['./edit-device.component.scss'],
})
export class EditDeviceComponent implements OnInit {
  loginuser: any;
  updateDeviceForm: FormGroup;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];
  devicetypelist: devicecodeType[] = [];
  numberregex: RegExp = /[0-9]+(\.[0-9]*){0,1}/;
  maxDate = new Date();
  public date: any;
  addmoredetals: any;
  shownomore: any;
  showaddmore: any;
  public sdgblist: any;
  id: number;
  externalid: any;
  showinput: boolean = true;
  serialNumber: any;
  status: any;
  projectName: any;
  address: any;
  latitude: any;
  longitude: any;
  countryCode: any;
  fuelCode: any;
  deviceTypeCode: any;
  capacity: any;
  SDGBenefits: any = [];
  commissioningDate: any;
  qualityLabels: any;
  offTaker: any;
  gridInterconnection: any;
  impactStory: any;
  showerror: boolean = false;
  deviceDescription: any;
  energyStorage: boolean = true;
  energyStorageCapacity: any;
  stateProvince: any;
  postcode: any;
  frommydevice: boolean = false;
  frombulk: boolean = false;
  filteredCountryList: Observable<any[]>;
  organizationId: any;
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
  devicediscription = [
    'Solar Lantern',
    'Solar Home System',
    'Mini Grid',
    'Rooftop Solar',
    'Ground Mount Solar',
  ];
  @ViewChild(MapComponent) mapComponent: MapComponent;

  constructor(
    private fb: FormBuilder,
    private authService: AuthbaseService,
    private deviceService: DeviceService,
    private router: Router,
    private toastrService: ToastrService,
    private activatedRoute: ActivatedRoute,
  ) {
    this.activatedRoute.queryParams.subscribe((params) => {
      if (params['fromdevices'] != undefined) {
        this.frommydevice = params['fromdevices'];
      }
      if (params['frombulk'] != undefined) {
        this.frombulk = params['frombulk'];
      }
    });
    this.externalid = this.activatedRoute.snapshot.params['id'];
    this.loginuser = JSON.parse(sessionStorage.getItem('loginuser')!);
  }

  ngOnInit() {
    this.DisplayList();
    this.DisplaySDGBList();
    this.DisplayfuelList();
    this.DisplaytypeList();

    this.date = new Date();
    this.updateDeviceForm = this.fb.group({
      serialNumber: [null, [Validators.pattern(/^[a-zA-Z0-9_-]+$/)]],
      //newserialNumber: [null, Validators.required],
      projectName: [null],
      address: [null, [Validators.required]],
      latitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      longitude: [
        null,
        [Validators.required, Validators.pattern(this.numberregex)],
      ],
      countryCode: [null, Validators.required],
      fuelCode: [null, [Validators.required]],
      deviceTypeCode: [null, [Validators.required]],
      capacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: [true],
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: [],
      energyStorageCapacity: [null],
      stateProvince: [null],
      qualityLabels: [null],
      SDGBenefits: [new FormControl([])],
      version: ['1.0'],
      organizationId: [null],
      postcode: [null, [postcodeValidator()]],
    });
    this.showinput = true;
    this.addmoredetals = false;
    this.showaddmore = true;
    this.shownomore = false;
    this.updateDeviceForm.valueChanges.subscribe();
    this.updateDeviceForm
      .get('latitude')
      ?.valueChanges.subscribe((latitude) => {
        const longitude = this.updateDeviceForm.get('longitude')?.value;
        this.updateMapMarkers(latitude, longitude);
      });
    this.updateDeviceForm
      .get('longitude')
      ?.valueChanges.subscribe((longitude) => {
        const latitude = this.updateDeviceForm.get('latitude')?.value;
        this.updateMapMarkers(latitude, longitude);
      });
    setTimeout(() => {
      this.updateDeviceForm.controls['countryCode'];
      this.filteredCountryList = this.updateDeviceForm.controls[
        'countryCode'
      ].valueChanges.pipe(
        startWith(''),
        map((value) => this._filter(value || '')),
      );
      this.getDeviceinfo();
    }, 1000);
  }
  private _filter(value: string): CountryInfo[] {
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
    return this.countrylist.filter((code) =>
      code.country.toLowerCase().includes(filterValue),
    );
  }
  getCountryCodeControl(): FormControl {
    return this.updateDeviceForm.get('countryCode') as FormControl;
  }
  checkValidation(input: string) {
    const validation =
      this.updateDeviceForm.get(input)?.invalid &&
      (this.updateDeviceForm.get(input)?.dirty ||
        this.updateDeviceForm.get(input)?.touched);
    return validation;
  }
  serialNumberErrors() {
    return this.updateDeviceForm.get('serialNumber')?.hasError('required')
      ? 'This field is required'
      : this.updateDeviceForm.get('serialNumber')?.hasError('pattern')
        ? 'serial number can contain only alphabets( lower and upper case included), numeric(0 to 9), hyphen(-), underscore(_) and spaces in between'
        : '';
  }
  DisplayList() {
    this.authService.GetMethod('countrycode/list').subscribe((data1: any) => {
      this.countrylist = data1;
    });
  }
  DisplaySDGBList() {
    this.authService.GetMethod('sdgbenefit/code').subscribe((data2) => {
      this.sdgblist = data2;
    });
  }
  DisplayfuelList() {
    this.authService.GetMethod('device/fuel-type').subscribe((data3: any) => {
      this.fuellist = data3;
    });
  }
  DisplaytypeList() {
    this.authService.GetMethod('device/device-type').subscribe((data4: any) => {
      this.devicetypelist = data4;
    });
  }
  shownewExternalidInput: boolean = false;
  showcancelicon: boolean = false;
  editExternalid() {
    this.shownewExternalidInput = true;
    this.showcancelicon = true;
  }
  hideeditExternalid() {
    this.shownewExternalidInput = false;
    this.updateDeviceForm.value.serialNumber = this.serialNumber;
    this.showcancelicon = false;
  }
  addmore() {
    this.addmoredetals = true;
    this.shownomore = true;
    this.showaddmore = false;
  }
  nomore() {
    this.addmoredetals = false;
    this.showaddmore = true;
    this.shownomore = false;
  }
  showenergycapacity_input(event: any) {
    if (event) {
      this.showinput = true;
    } else {
      this.showinput = false;
    }
  }
  getDeviceinfo() {
    this.deviceService
      .getDeviceInfoBYexternalId(this.externalid)
      .subscribe((data) => {
        this.id = data.id;
        this.serialNumber = data.serialNumber;
        this.status = data.status;
        this.projectName = data.projectName;
        this.address = data.address;
        this.latitude = data.latitude;
        this.longitude = data.longitude;
        this.countryCode = this.countrylist.find(
          (countrycode) => countrycode.alpha3 == data.countryCode,
        )?.country;
        this.fuelCode = data.fuelCode;
        this.deviceTypeCode = data.deviceTypeCode;
        this.capacity = data.capacity;
        this.postcode = data.postcode;
        data.SDGBenefits.forEach((sdgbname: string, index: number) => {
          const foundEle = this.sdgblist.find(
            (ele: any) =>
              ele.value.toLowerCase() === sdgbname.toString().toLowerCase(),
          );
          data.SDGBenefits[index] = foundEle.name;
        });
        this.SDGBenefits = data.SDGBenefits;
        this.commissioningDate = data.commissioningDate;
        this.offTaker = data.offTaker;
        this.qualityLabels = data.qualityLabels;
        this.impactStory = data.impactStory;
        this.gridInterconnection = data.gridInterconnection;
        this.deviceDescription = data.deviceDescription;
        if (data.energyStorage != null) {
          this.energyStorage = data.energyStorage;
        } else {
          this.energyStorage = false;
        }

        this.energyStorageCapacity = data.energyStorageCapacity;
        this.stateProvince = data.stateProvince;
        this.organizationId = data.organizationId;
        this.updateDeviceForm.patchValue({
          serialNumber: data.serialNumber,
        });
      });
  }
  onSubmit() {
    const selectedCountry: CountryInfo | undefined = this.countrylist.find(
      (option) => option.country === this.updateDeviceForm.value.countryCode,
    );
    this.updateDeviceForm.controls['organizationId'].setValue(
      this.organizationId,
    );
    this.updateDeviceForm.value['countryCode'] = selectedCountry?.alpha3;
    this.deviceService
      .Patchdevices(this.externalid, this.updateDeviceForm.value)
      .subscribe({
        next: (data: any) => {
          this.toastrService.success(
            'Updated Successfully !!',
            'Device! ' + data.serialNumber,
          );
          if (this.loginuser.role === 'Admin') {
            this.router.navigate(['/admin/All_devices']);
          } else if (this.loginuser.role === 'ApiUser') {
            this.router.navigate(['/apiuser/All_devices']);
          } else {
            this.router.navigate(['/device/AllList']);
          }
        },
        error: (err: any): void => {
          //Error callback
          console.error('error caught in component', err.error.message);
          this.toastrService.error(
            'some error occurred in updated due to ,' + err.error.message,
            'Device!' + this.externalid,
          );
        },
      });
    // })
  }
  reset() {
    if (this.frombulk) {
      this.router.navigate(['/device/bulk_upload']);
    } else {
      this.router.navigate(['/device/AllList']);
    }
  }

  updateMapMarkers(latitude: any, longitude: any) {
    if (this.mapComponent && latitude && longitude) {
      const markers = [
        {
          latitude: parseFloat(latitude),
          longitude: parseFloat(longitude),
        },
      ];

      // Set the markers on the map component
      this.mapComponent.markers = [...markers];

      // If the map is already initialized, update it directly
      if (this.mapComponent.isMapInitialized) {
        this.mapComponent.update();
      }
    }
  }
}
