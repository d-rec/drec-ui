[
   
    {
        action: "click",
        selector: '[data-testid="devices"]',
      },

      {
        action: "click",
        selector: '[data-testid="add-devices"]',
      },
      {
        action: "type",
        selector: '[data-testid="project-name"]',
        value:"test device"
      },
      {
        action: "type",
        selector: '[data-testid="external-id"]',
        value:"testdevice123"
      },
      {
        action: "select",
        selector: '[data-testid="select-countly"]',
        option: '[data-testid="country-options"]'
      },
        {
          action: "click",
          selector: '[data-testid="commissioning-date"]',
        },
        {
          action: "pick",
          selector: '[data-testid="date-picker"]'
        },
        
        {
          action: "type",
          selector: '[data-testid="capacity"]',
          value:"100"
        },
        {
          action: "type",
          selector: '[data-testid="address"]',
          value:"testing"
        },
        {
          action: "type",
          selector: '[data-testid="latitude"]',
          value:"21.00876"
        },
        {
          action: "type",
          selector: '[data-testid="longitude"]',
          value:"31.00876"
        },
        {
          action: "select",
          selector: '[data-testid="fuelcode"]',
          option:'[data-testid="fuel-option"]'
        },
        {
          action: "select",
          selector: '[data-testid="device-type"]',
          option:'[data-testid="typecode-option"]'
        },
        {
          action: "select",
          selector: '[data-testid="SDGBenefits"]',
          option:'[data-testid="SDGBenefits-option"]'
        },
        {
          action: "submit",
          selector: '[data-testid="submit-device"]',
        }
    ]