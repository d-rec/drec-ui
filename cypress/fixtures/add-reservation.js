[
  {
    action: 'click',
    selector: '[test-id="reservations"]',
  },
  {
    action: 'click',
    selector: '[test-id="add-reservation"]',
  },

  {
    action: 'type',
    selector: '[test-id="reservation-name"]',
    value: 'test reservation',
  },
  {
    action: 'type',
    selector: '[test-id="target-capacity"]',
    value: 100,
  },
  {
    action: 'type',
    selector: '[test-id="reservation-start-date"]',
    value: '11/30/2024, 12:48:18 PM',
  },
  {
    action: 'type',
    selector: '[test-id="reservation-end-date"]',
    value: '5/31/2025, 12:48:42 PM',
  },
  {
    action: 'type',
    selector: '[test-id="reservation-expiry-date"]',
    value: '5/31/2025, 12:50:30 PM',
  },
  {
    action: 'select',
    selector: 'mat-select[formControlName="frequency"]',
    option: '[frequency-test-id]',
  },
  {
    action: 'select',
    selector: 'input[formControlName="countryname"]',
    option: '[country-test-id]',
  },
  {
    action: 'click',
    selector: '[test-id="filter-button"]',
  },
  {
    action: 'check',
    selector: '[test-id="device-check"]',
    index: 0,
  },
  {
    action: 'click',
    selector: '[test-id="submit-reservation"]',
  },
  {
    action: 'click',
    selector: '[test-id="continue-reservation"]',
  },
]
