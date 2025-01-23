[
  {
    action: 'click',
    selector: '[data-testid="MeterRead"]',
  },

  {
    action: 'click',
    selector: '[data-testid="add-meterRead"]',
  },
  {
    action: 'selected',
    selector: '[placeholder="Search External ID"]',
    option: '[externalid-testid]',
  },
  {
    action: 'select-timezone',
    selector: '[placeholder="Please Enter Timezone"]',
    option: '[timezone-testid]',
  },
  {
    action: 'select',
    selector: 'mat-select[formControlName="type"]',
    option: '[readtype-testid]',
  },
  {
    action: 'select',
    selector: 'mat-select[formControlName="unit"]',
    option: '[unit-testid]',
  },
  {
    action: 'type',
    selector: '[placeholder="Read value"]',
    value: '100',
  },
  {
    action: 'start-date',
    selector: 'mat-datepicker-toggle',
    option: '[role="gridcell"]',
  },
  {
    action: 'end-date',
    selector: 'mat-datepicker-toggle',
    option: '[role="gridcell"]',
  },
  {
    action: 'click',
    selector: '[data-testid="submitRead"]',
  },
];
