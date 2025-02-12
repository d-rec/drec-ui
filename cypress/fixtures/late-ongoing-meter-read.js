[
    {
      action: 'click',
      selector: '[test-id="meter-read"]',
    },
  
    {
      action: 'click',
      selector: '[test-id="add-meter-read"]',
    },
    {
      action: 'selected',
      selector: '[placeholder="Search External ID"]',
      option: '[external-id-test-id]',
    },
    {
      action: 'select-timezone',
      selector: '[placeholder="Please Enter Timezone"]',
      option: '[timezone-test-id]',
    },
    {
      action: 'select',
      selector: 'mat-select[formControlName="type"]',
      option: '[read-type-test-id]',
    },
    {
      action: 'select',
      selector: 'mat-select[formControlName="unit"]',
      option: '[unit-test-id]',
    },
    {
      action: 'type',
      selector: '[placeholder="Read value"]',
      value: '100',
    },
    {
      action: 'date-picker',
      selector: '[placeholder="Choose a end date"]',
    },
    {
      action: 'click',
      selector: '[test-id="submit-read"]',
    },
  ]
  