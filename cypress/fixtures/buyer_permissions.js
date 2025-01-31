[
  {
    action: 'click',
    selector: '[data-testid="permission"]',
  },
  {
    action: 'click',
    selector: '[data-testid="user_role_permission"]',
  },
  {
    action: 'click',
    selector: '.add-user-role-permissions',
  },
  {
    action: 'select',
    selector: '[data-testid="add-user-role"]',
    option: '[data-testid="userRole-option"]',
  },
  {
    action: 'check',
    selector: '[data-testid="module-check"]',
    index: 3,
  },
  {
    action: 'check-multiple',
    selector: '[data-testid="permission-check"]',
    contains: 'DEVICE_MANAGEMENT_CRUDL',
  },
  {
    action: 'check',
    selector: '[data-testid="module-check"]',
    index: 4,
  },
  {
    action: 'check-multiple',
    selector: '[data-testid="permission-check"]',
    contains: 'BUYER_RESERVATION_MANAGEMENT_CRUDL',
  },
  {
    action: 'check',
    selector: '[data-testid="module-check"]',
    index: 6,
  },
  {
    action: 'check-multiple',
    selector: '[data-testid="permission-check"]',
    contains: 'READS_MANAGEMENT_CRUDL',
  },

  {
    action: 'check',
    selector: '[data-testid="module-check"]',
    index: 7,
  },
  {
    action: 'check-multiple',
    selector: '[data-testid="permission-check"]',
    contains: 'CERTIFICATE_LOG_MANAGEMENT_CRUDL',
  },
  {
    action: 'check',
    selector: '[data-testid="module-check"]',
    index: 10,
  },
  {
    action: 'check-multiple',
    selector: '[data-testid="permission-check"]',
    contains: 'PASSWORD_MANAGEMENT_CRUDL',
  },
  {
    action: 'submit',
    selector: '[data-testid="submit-permission"]',
  }
]
