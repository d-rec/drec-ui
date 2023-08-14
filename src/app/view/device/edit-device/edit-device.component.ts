import { Component, OnInit } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { DeviceService } from '../../../auth/services/device.service'
import { Router, ActivatedRoute } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable, Subscription } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
@Component({
  selector: 'app-edit-device',
  templateUrl: './edit-device.component.html',
  styleUrls: ['./edit-device.component.scss']
})
export class EditDeviceComponent implements OnInit {

  updatedeviceform: FormGroup;
  countrylist: any;
  fuellist: any;
  devicetypelist: any;
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
  externalId: any;
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
  showerror: boolean = false
  deviceDescription: any;
  energyStorage: boolean = true;
  energyStorageCapacity: any;
  frommydevice: boolean = false;
  frombulk: boolean = false;
  filteredCountryList: Observable<any[]>
  offteker = ['School', 'Health Facility', 'Residential', 'Commercial', 'Industrial', 'Public Sector', 'Agriculture']
  devicediscription = ['Solar Lantern', 'Solar Home System', 'Mini Grid', 'Rooftop Solar', 'Ground Mount Solar'];

  constructor(private fb: FormBuilder, private authService: AuthbaseService,
    private deviceService: DeviceService, private router: Router,
    private toastrService: ToastrService, private activatedRoute: ActivatedRoute,) {
    this.activatedRoute.queryParams.subscribe(params => {
      if (params['fromdevices'] != undefined) {
        this.frommydevice = params['fromdevices'];
        console.log(this.frommydevice);
      }
      if (params['frombulk'] != undefined) {
        this.frombulk = params['frombulk'];
        console.log(this.frombulk);
      }
    });
    this.externalid = this.activatedRoute.snapshot.params['id'];
  }

  ngOnInit() {

    this.DisplayList();
    this.DisplaySDGBList();
    this.DisplayfuelList();
    this.DisplaytypeList();

    this.date = new Date();
    this.updatedeviceform = this.fb.group({
      externalId: [null, [ Validators.pattern(/^[a-zA-Z\d\-_\s]+$/)]],
      //newexternalId: [null, Validators.required],
      projectName: [null],
      address: [null, [Validators.required]],
      latitude: [null, [Validators.required, Validators.pattern(this.numberregex)]],
      longitude: [null, [Validators.required, Validators.pattern(this.numberregex)]],
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
      qualityLabels: [null],
      SDGBenefits: [new FormControl([])
      ],
      version: ["1.0"]

    })
    this.showinput = true;
    this.addmoredetals = false;
    this.showaddmore = true;
    this.shownomore = false;
    this.updatedeviceform.valueChanges.subscribe(console.log);
    setTimeout(() => {
      this.updatedeviceform.controls['countryCode'];
      this.filteredCountryList = this.updatedeviceform.controls['countryCode'].valueChanges.pipe(
        startWith(''),
        map(value => this._filter(value || '')),
      );
      this.getDeviceinfo();
    }, 1000);

  }
  private _filter(value: string): any[] {
    const filterValue = value.toLowerCase();

    if (!(this.countrylist.filter((option: any) => option.country.toLowerCase().includes(filterValue)).length > 0)) {
      this.showerror = true;
      //  toppings.at(i).get('countryCode').setValue(null);
    } else {
      this.showerror = false;
    }
    //@ts-ignore
    return this.countrylist.filter(code => code.country.toLowerCase().includes(filterValue));
  }
  getCountryCodeControl(): FormControl {
    return this.updatedeviceform.get('countryCode') as FormControl;
  }
  checkValidation(input: string) {
    const validation = this.updatedeviceform.get(input)?.invalid && (this.updatedeviceform.get(input)?.dirty || this.updatedeviceform.get(input)?.touched)
    return validation;
  }
  externalIdErrors() {
    return this.updatedeviceform.get('externalId')?.hasError('required') ? 'This field is required' :
      this.updatedeviceform.get('externalId')?.hasError('pattern') ? 'external id can contain only alphabets( lower and upper case included), numeric(0 to 9), hyphen(-), underscore(_) and spaces in between' : ''

  }
  DisplayList() {

    this.authService.GetMethod('countrycode/list').subscribe(
      (data1) => {
        // display list in the console 
        console.log(data1)
        this.countrylist = data1;

      }
    )
  }
  DisplaySDGBList() {

    this.authService.GetMethod('sdgbenefit/code').subscribe(
      (data2) => {
        // display list in the console 
        console.log(data2)
        this.sdgblist = data2;

      }
    )
  }
  DisplayfuelList() {

    this.authService.GetMethod('device/fuel-type').subscribe(
      (data3) => {
        // display list in the console 

        this.fuellist = data3;

      }
    )
  }
  DisplaytypeList() {

    this.authService.GetMethod('device/device-type').subscribe(
      (data4) => {
        // display list in the console 

        this.devicetypelist = data4;

      }
    )
  }
  shownewExternalidInput: boolean = false;
  showcancelicon: boolean = false;
  editExternalid() {
    this.shownewExternalidInput = true;
    this.showcancelicon = true;
  }
  hideeditExternalid() {
    this.shownewExternalidInput = false;
    this.updatedeviceform.value.externalId = this.externalId;
    this.showcancelicon = false;
    console.log(this.updatedeviceform);
  }
  addmore() {
    this.addmoredetals = true;
    this.shownomore = true;
    this.showaddmore = false
  }
  nomore() {
    this.addmoredetals = false;
    this.showaddmore = true;
    this.shownomore = false;
  }
  showenergycapacity_input(event: any) {
    console.log(event)
    if (event) {
      this.showinput = true;
    } else {
      this.showinput = false;
    }
  }
  getDeviceinfo() {
    this.deviceService.getDeviceInfoBYexternalId(this.externalid).subscribe(
      (data) => {
        console.log(data);
        this.id = data.id;
        this.externalId = data.externalId;
        this.status = data.status;
        this.projectName = data.projectName;
        this.address = data.address;
        this.latitude = data.latitude;
        this.longitude = data.longitude;
        //@ts-ignore
        this.countryCode = this.countrylist.find(countrycode => countrycode.alpha3 == data.countryCode)?.country;
        this.fuelCode = data.fuelCode;
        this.deviceTypeCode = data.deviceTypeCode;
        this.capacity = data.capacity;
        data.SDGBenefits.forEach(
          (sdgbname: string, index: number) => {
            //@ts-ignore
            let foundEle = this.sdgblist.find(ele => ele.value.toLowerCase() === sdgbname.toString().toLowerCase());
            data.SDGBenefits[index] = foundEle.name
            console.log(data.SDGBenefits);
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

        console.log(this.energyStorage);
        this.energyStorageCapacity = data.energyStorageCapacity;


      })

  }
  onSubmit() {

    console.log(this.updatedeviceform);
    if (this.updatedeviceform.value.externalId === null) {
      this.updatedeviceform.removeControl('externalId');
    }
    console.log(this.updatedeviceform);
    this.deviceService.Patchdevices(this.externalid, this.updatedeviceform.value).subscribe({
      next: (data: any) => {
        console.log(data)
        // this.deviceForms.reset();
        this.toastrService.success('Updated Successfully !!', 'Device! ' + this.updatedeviceform.value.externalId);
        this.router.navigate(['device/AllList']);
      },
      error: (err: any): void => {                          //Error callback
        console.error('error caught in component', err.error.message)
        this.toastrService.error('some error occurred in add due to ' + err.error.message, 'Device!' + this.updatedeviceform.value.externalId,);
      }
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
}
