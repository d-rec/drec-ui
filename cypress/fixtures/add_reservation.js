[
   
    {
        action: "click",
        selector: '[data-testid="add-reservation"]',
      },
  
      {
        action: "type",
        selector: '[data-testid="reservation-name"]',
        value: "test reservation"
      },
      {
        action: "type",
        selector: '[data-testid="targetCapacity"]',
        value: 100
      },
      {
        action: "type",
        selector: '[data-testid="reservationStartDate"]',
        value: '11/30/2024, 12:48:18 PM'
      },
      {
        action: "type",
        selector: '[data-testid="reservationEndDate"]',
        value: '5/31/2025, 12:48:42 PM'
      },
      {
        action: "type",
        selector: '[data-testid="reservationExpiryDate"]',
        value: '5/31/2025, 12:50:30 PM'
      },
      {
        action: "select",
        selector: 'mat-select[formControlName="frequency"]',
        option: '[frequency-testid]'
      },
      {
        action: "select",
        selector: 'input[formControlName="countryname"]',
        option: '[country-testid]'
      },
      {
        action: "click",
        selector: '[data-testid="Filterbutton"]',
      },
      {
        action: "check",
        selector: '[data-testid="device-check"]',
        index:0
      },
      {
        action: "click",
        selector: '[data-testid="submit-reservation"]',
      },
      {
        action: "click",
        selector: '[data-testid="continue-reservation"]',
      }
    ]