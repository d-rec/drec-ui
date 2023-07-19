import { Component, OnInit, NgZone } from '@angular/core';
import { FormGroup, FormBuilder, FormArray, Validators, FormControl } from '@angular/forms';
import { AuthbaseService } from '../../../auth/authbase.service';
import { DeviceService } from '../../../auth/services/device.service';
import { Router } from '@angular/router';
import { ToastrService } from 'ngx-toastr';
import { Observable ,Subscription} from 'rxjs';
import { startWith, map } from 'rxjs/operators';
//import * as moment from 'moment';
@Component({
  selector: 'app-add-devices',
  templateUrl: './add-devices.component.html',
  styleUrls: ['./add-devices.component.scss']
})
export class AddDevicesComponent {
  myform: FormGroup;
  countrylist: any;
  fuellist: any;
  devicetypelist: any;
  hide = true;
  addmoredetals: any[] = [];
  shownomore: any[] = [];
  showaddmore: any[] = [];
  showerror:any[]=[];
  maxDate = new Date();
  public date: any;
  public sdgblist: any;
  public disabled = false;
  public showSpinners = true;
  public showSeconds = false;
  public touchUi = false;
  public enableMeridian = false;
  // public minDate: moment.Moment;
  //public maxDate: moment.Moment;
  public stepHour = 1;
  public stepMinute = 1;
  public stepSecond = 1;
  numberregex: RegExp = /[0-9]+(\.[0-9]*){0,1}/
  filteredCountryList: Observable<any[]>[] = [];
  subscription: Subscription;
  //public color: ThemePalette = 'primary';
  offtaker = ['School', 'Health Facility', 'Residential', 'Commercial', 'Industrial', 'Public Sector', 'Agriculture']
  devicedescription = ['Solar Lantern', 'Solar Home System', 'Mini Grid', 'Rooftop Solar', 'Ground Mount Solar'];
  constructor(private fb: FormBuilder, private authService: AuthbaseService,
    private deviceService: DeviceService,
    private router: Router,
    private toastrService: ToastrService) {
     
  }

  ngOnInit() {

    this.DisplayList();
    this.DisplaySDGBList();
    this.DisplayfuelList();
    this.DisplaytypeList();
    this.date = new Date();
    this.myform = this.fb.group({

      devices: this.fb.array([
      ])
    })
    this.showinput[0] = true;
    this.addmoredetals[0] = false;
    this.showaddmore[0] = true;
    this.showerror[0] = false;
    this.shownomore[0] = false;
    this.myform.valueChanges.subscribe(console.log);
    const device = this.fb.group({
      externalId: [null, [Validators.required, Validators.pattern(/^[a-zA-Z\d\-_\s]+$/)]],
      projectName: [null],
      address: [null],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCode: [null, Validators.required],
      fuelCode: [null],
      deviceTypeCode: [null],
      capacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: [true],
      offTaker: [null],
      impactStory: [null],
      data: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: [true],
      energyStorageCapacity: [null],
      qualityLabels: [null],
      SDGBenefits: [[new FormControl([])]
      ],
      version: ["1.0"]
    })
    this.deviceForms.push(device);

    setTimeout(() => {
      this.filteredCountryList[0] = this.getCountryCodeControl(0).valueChanges.pipe(
        startWith(''),
        map(value => this._filter(value || '',0))
      );
    },1000);
    
  }
  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }
  get deviceForms() {
    return this.myform.get('devices') as FormArray
  }
 
  DisplayList() {

    this.authService.GetMethod('countrycode/list').subscribe(
      (data) => {
        // display list in the console 
        this.countrylist = data;

      }
    )
  }
  DisplaySDGBList() {

    this.authService.GetMethod('sdgbenefit/code').subscribe(
      (data) => {
        // display list in the console 

        this.sdgblist = data;

      }
    )
  }
  DisplayfuelList() {

    this.authService.GetMethod('device/fuel-type').subscribe(
      (data) => {
        // display list in the console 

        this.fuellist = data;

      }
    )
  }
  DisplaytypeList() {

    this.authService.GetMethod('device/device-type').subscribe(
      (data) => {
        // display list in the console 

        this.devicetypelist = data;

      }
    )
  }
 

  // selectCountry(event: any,i:number) {
  //   console.log(event);
  //   console.log(this.filteredCountryList[i])
  //   const toppings: any = this.myform.get('devices') as FormArray
  //   this.subscription = this.filteredCountryList[i].subscribe(options => {
  //     console.log(options);
  //     const selectedCountry = options.find(option => option.country === event.option.value);
  //     if (selectedCountry) {
  //       console.log(toppings.value[i]);
  //       console.log(toppings.value[i].countryCode);
  //       // toppings.value[i].countryCode.setValue(selectedCountry.alpha3);
  //       toppings.at(i).get('countryCode').setValue(selectedCountry.alpha3);
  //       //this.deviceForms.controls.map(control => control['countryCode']).setValue(selectedCountry.alpha3);
  //     }
  //   });
  // }
  onSDGBRemoved(topping: string, i: number) {
    const toppings: any = this.myform.get('devices') as FormArray
    const sdgb = toppings[i].SDGBenefits.value as string[];
    this.removeFirst(sdgb, topping);
    toppings[i].SDGBenefits.setValue(sdgb); // To trigger change detection
  }

  private removeFirst<T>(array: T[], toRemove: T): void {
    const index = array.indexOf(toRemove);
    if (index !== -1) {
      array.splice(index, 1);
    }
  }
  adddevice() {
    const device = this.fb.group({
      externalId: [null, [Validators.required, Validators.pattern(/^[a-zA-Z\d\-_\s]+$/)]],
      projectName: [null],
      address: [null],
      latitude: [null, Validators.pattern(this.numberregex)],
      longitude: [null, Validators.pattern(this.numberregex)],
      countryCode: [null, Validators.required],
      fuelCode: [null],
      deviceTypeCode: [null],
      capacity: [null, Validators.required],
      commissioningDate: [new Date(), Validators.required],
      gridInterconnection: true,
      offTaker: [null],
      impactStory: [null],
      images: [null],
      deviceDescription: [null],
      energyStorage: true,
      energyStorageCapacity: [null],
      qualityLabels: [null],
      SDGBenefits: [[new FormControl([])]
      ],
      version: ["1.0"]
    })
    this.deviceForms.push(device);
    console.log(this.deviceForms.length);
    this.showaddmore[this.deviceForms.length - 1] = true;
    this.showinput[this.deviceForms.length - 1] = true;
    const index = this.deviceForms.length - 1;
  this.filteredCountryList[index] = this.getCountryCodeControl(index).valueChanges.pipe(
    startWith(''),
    map(value => this._filter(value || '',index))
  );
  }
  private _filter(value: string,i:number): any[] {
    const filterValue = value.toLowerCase();
    const toppings: any = this.myform.get('devices') as FormArray;
    if (!(this.countrylist.filter((option: any) => option.country.toLowerCase().includes(filterValue)).length > 0)) {
      this.showerror[i] = true;
    //  toppings.at(i).get('countryCode').setValue(null);
    } else {
      this.showerror[i] = false;
    }
  //@ts-ignore
    return this.countrylist.filter(code => code.country.toLowerCase().includes(filterValue));
  }
  addmore(i: number) {
    this.addmoredetals[i] = true;
    this.shownomore[i] = true;
    this.showaddmore[i] = false
  }
  nomore(i: number) {
    this.addmoredetals[i] = false;
    this.showaddmore[i] = true;
    this.shownomore[i] = false;
  }
  showinput: any[] = [];
  showenergycapacity_input(i: number, event: any) {
    console.log(event)
    if (event) {
      this.showinput[i] = true;
    } else {
      this.showinput[i] = false;
    }
  }
  deleteDevice(i: number) {
    this.deviceForms.removeAt(i)
  }
 

  getCountryCodeControl(index: number): FormControl {
    return this.deviceForms.at(index).get('countryCode') as FormControl;
  }
//   private _filter(value: string): any[] {
//     const filterValue = value.toLowerCase();
// //@ts-ignore
//     return this.countrylist.filter(code => code.country.toLowerCase().includes(filterValue));
//   }
  onSubmit() {

    const formArray = this.myform.get('devices') as FormArray;
    let deviceArray = this.myform.value.devices;
    deviceArray.forEach((element: any, index: number) => {
      //@ts-ignore
      const selectedCountry = this.countrylist.find(option => option.country === element.countryCode);
     element['countryCode']=selectedCountry.alpha3;
      this.deviceService.Postdevices(element).subscribe({
        next: data => {

          //  const formGroup = formArray.at(index);
          // this.deviceForms.reset();
          this.toastrService.success('Added Successfully !!', 'Device! ' + element.externalId);
          // formGroup.reset();
          // while (formArray.length > 1) {
          //   formArray.removeAt(1);
          // }

          const index1 = deviceArray.indexOf(element);
          deviceArray.splice(index, 1);
          console.log(deviceArray)
          // Check if formDataArray is empty
          if (deviceArray.length === 0) {
            // Navigate to the list UI page
            this.router.navigate(['/device/AllList']);
          }
        },
        error: err => {                          //Error callback
          console.error('error caught in component', err.error.message)
          this.toastrService.error('some error occurred in add due to ' + err.error.message, 'Device!' + element.externalId,);
        }
      });
    })
  }
}
