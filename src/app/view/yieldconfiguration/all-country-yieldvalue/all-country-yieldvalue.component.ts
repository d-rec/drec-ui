
import {
  Component,
  ViewChild,
} from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';
import { AuthbaseService } from '../../../auth/authbase.service';
import { YieldConfigurationService } from '../../../auth/services/yieldConfiguration.service';
import { Router } from '@angular/router';
import { YieldConfig } from '../../../models/yieldvalue.model';
@Component({
  selector: 'app-all-country-yieldvalue',
  templateUrl: './all-country-yieldvalue.component.html',
  styleUrls: ['./all-country-yieldvalue.component.scss'],
})
export class AllCountryYieldvalueComponent {
  countrylist: any;
  countrycodeLoded: boolean = false;
  data: YieldConfig[];
  displayedColumns = ['country', 'value', 'status', 'actions'];
  @ViewChild(MatPaginator) paginator: MatPaginator;
  @ViewChild(MatSort) sort: MatSort;
  dataSource: MatTableDataSource<any>;
  loading: boolean = true;
  pageSize: number = 20;
  totalRows: number;
  constructor(
    private authService: AuthbaseService,
    private yieldService: YieldConfigurationService,
    private router: Router,
  ) {}
  ngOnInit(): void {
    this.authService.GetMethod('countrycode/list').subscribe((data3) => {
      this.countrylist = data3;
      this.countrycodeLoded = true;
    });

    setTimeout(() => {
      this.loading = false;
      this.getCountryyieldListData();
    }, 1000);
  }

  getCountryyieldListData() {
    this.yieldService.getyieldList().subscribe((data: any) => {
      this.data = data;
      this.dataSource = new MatTableDataSource(this.data);
      this.totalRows = this.data.length;
      this.dataSource.paginator = this.paginator;
      this.dataSource.sort = this.sort;
    });
  }
  UpdateYield(id: number) {
    this.router.navigate(['/admin/yield/edit/' + id]);
  }
}
