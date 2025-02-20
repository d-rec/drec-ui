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
    action: 'type',
    selector: '[placeholder="Choose a start date"]',
    value: '12/10/2024, 12:43:54 PM',
  },
  {
    action: 'type',
    selector: '[]',
    value: '1/6/2025, 12:44:55 PM',
  },
  {
    action: 'click',
    selector: '[test-id="submit-read"]'
  }
]
