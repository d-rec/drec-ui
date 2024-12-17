[
   
    {
        action: "click",
        selector: '[data-testid="MeterRead"]',
      },

      {
        action: "click",
        selector: '[data-testid="add-meterRead"]',
      },
      {
        action: "select",
        selector: '[placeholder="Search External ID"]',
        option: '[role="option"]'
      },
      {
        action: "select-timezone",
        selector: '[placeholder="Please Enter Timezone"]',
        option: '[role="option"]'
      },
      {
        action: "select",
        selector: 'mat-select[formControlName="type"]',
        option: '[role="option"]'
      },
      {
        action: "select",
        selector: 'mat-select[formControlName="unit"]',
        option: '[role="option"]'
      },
      {
        action: "type",
        selector: '[placeholder="Read value"]',
        value:"100"
      },
      {
        action: "start-date",
        selector: 'mat-datepicker-toggle',
        option: '[role="gridcell"]'
      },
      {
        action: "end-date",
        selector: 'mat-datepicker-toggle',
        option: '[role="gridcell"]'
      },
      {
        action: "click",
        selector: '[data-testid="submitRead"]',
      }
  
    ]