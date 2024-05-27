import { Component, OnInit, ViewChild } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { ReservationService } from '../../auth//services/reservation.service';
import { Router } from '@angular/router';
import { AuthbaseService } from '../../auth/authbase.service';
import { fulecodeType, CountryInfo } from '../../models';
@Component({
  selector: 'app-redemption-report',
  templateUrl: './redemption-report.component.html',
  styleUrls: ['./redemption-report.component.scss'],
})
export class RedemptionReportComponent implements OnInit {
  data: any = [];
  displayedColumns = [
    'certificateId',
    'redemptionDate',
    'certifiedEnergy',
    'compliance',
    'country',
    'fuelCode',
    'beneficiary',
    'beneficiary_address',
    'claimCoiuntryCode',
    'capacityRange',
    'purpose',
    'offTakers',
  ];
  pageSize: number = 20;
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  countrylist: CountryInfo[] = [];
  fuellist: fulecodeType[] = [];

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

  constructor(
    private authService: AuthbaseService,
    private ReservationService: ReservationService,
    private router: Router,
  ) {}
  ngOnInit(): void {
    this.DisplayfuelList();
    this.DisplaycountryList();
    this.DisplayRedemptionList();
  }
  DisplayfuelList() {
    this.authService.GetMethod('device/fuel-type').subscribe((data: any) => {
      this.fuellist = data;
    });
  }
  DisplaycountryList() {
    this.authService.GetMethod('countrycode/list').subscribe((data: any) => {
      this.countrylist = data;
    });
  }
  DisplayRedemptionList() {
    this.ReservationService.GetMethod().subscribe((data) => {
      this.data = data;
      this.data.forEach((ele: any) => {
        if (ele.fuelCode != '') {
          const fuelname: any = [];
          const f = ele.fuelCode.filter((str: any) => str !== ' ');
          f.map((aele: any) =>
            fuelname.push(
              this.fuellist.find((fuelType) => fuelType.code === aele.trim())
                ?.name,
            ),
          );
          ele['fuelname'] = [...new Set(fuelname)].toString();
        } else {
          ele['fuelname'] = '';
        }
        ele.country.filter((str: any) => str !== '');
        if (ele.country != '') {
          ele['countryname'] = [
            ...new Set(
              ele.country.map(
                (bele: any) =>
                  this.countrylist.find(
                    (countrycode: CountryInfo) =>
                      countrycode.alpha3 === bele.trim(),
                  )?.country,
              ),
            ),
          ].toString();
        } else {
          ele['countryname'] = '';
        }
        ele['claimCoiuntryCode'] = this.countrylist.find(
          (countrycode: CountryInfo) =>
            countrycode.alpha3 === ele.claimCoiuntryCode,
        )?.country;

        const o = ele.offTakers.filter((str: any) => str !== ' ');
        ele['offTakername'] = [
          ...new Set(o.map((e: any) => e.trim())),
        ].toString();
      });

      this.dataSource = new MatTableDataSource(this.data);
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }
}
