[
   
    {
        action: "click",
        selector: '[data-testid="add-reservation"]',
      },
  
      {
        action: "type",
        selector: '[data-testid="reservation-name"]',
        value: "Test reservation"
      },
      {
        action: "type",
        selector: '[data-testid="targetCapacity"]',
        value: 100
      },
      {
        action: "type",
        selector: '[data-testid="reservationStartDate"]',
        value: '9/10/2024, 1:25:51 PM'
      },
      {
        action: "type",
        selector: '[data-testid="reservationEndDate"]',
        value: '1/6/2025, 1:27:11 PM'
      },
      {
        action: "type",
        selector: '[data-testid="reservationExpiryDate"]',
        value: '1/31/2025, 1:27:29 PM'
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
    ]