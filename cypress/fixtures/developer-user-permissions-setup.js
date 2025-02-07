[
  {
    action: 'click',
    selector: '[test-id="permission"]',
  },

  {
    action: 'click',
    selector: '[test-id="user-role-permission"]',
  },
  {
    action: 'click',
    selector: '.add-user-role-permissions',
  },
  {
    action: 'select',
    selector: '[test-id="add-user-role"]',
    option: '[test-id="user-role-option"]',
  },
  {
    action: 'check',
    selector: '[test-id="select-module"]',
    index: 3,
  },
  {
    action: 'check-multiple',
    selector: '[test-id="select-permission"]',
    contains: 'DEVICE_MANAGEMENT_CRUDL',
  },
  {
    action: 'check',
    selector: '[test-id="select-module"]',
    index: 6,
  },
  {
    action: 'check-multiple',
    selector: '[test-id="select-permission"]',
    contains: 'READS_MANAGEMENT_CRUDL',
  },

  {
    action: 'submit',
    selector: '[test-id="submit-permission"]',
  },
]
