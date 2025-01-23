[
  {
    action: 'click',
    selector: '[data-testid="permission"]',
  },

      {
        action: "click",
        selector: '[data-testid="user_role_permission"]'
      },
      {
        action: "click",
        selector: '.add-user-role-permissions'
      },
      {
        action: "select",
        selector: '[data-testid="add-user-role"]',
        option: '[data-testid="userRole-option"]'
      },
      {
        action: "check",
        selector: '[data-testid="module-check"]',
        index:3
      },
      {
        action: "check-multiple",
        selector: '[data-testid="permission-check"]',
        contains: "DEVICE_MANAGEMENT_CRUDL"
      },
      
      {
        action: "submit",
        selector: '[data-testid="submit-permission"]'
      },
    ]
