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
      action: "selected",
      selector: '[placeholder="Search External ID"]',
      option: '[externalid-testid]'
    },
    {
      action: "select-timezone",
      selector: '[placeholder="Please Enter Timezone"]',
      option: '[timezone-testid]'
    },
    {
      action: "select",
      selector: 'mat-select[formControlName="type"]',
      option: '[readtype-testid]'
    },
    {
      action: "select",
      selector: 'mat-select[formControlName="unit"]',
      option: '[unit-testid]'
    },
    {
      action: "type",
      selector: '[placeholder="Read value"]',
      value:"100"
    },
    {
      action: "type",
      selector: '[placeholder="Choose a start date"]',
      value: '12/10/2024, 12:43:54 PM'
    },
    {
      action: "type",
      selector: '[placeholder="Choose a end date"]',
      value: '1/6/2025, 12:44:55 PM'
    },
    {
      action: "click",
      selector: '[data-testid="submitRead"]',
    }

  ]