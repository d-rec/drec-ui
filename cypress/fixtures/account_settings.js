[
  {
    action: 'click',
    selector: '[settings-testid="account-setting-header"]',
  },
  {
    action: 'click',
    selector: '[data-testid="profile"]',
  },
  {
    action: 'type',
    selector: '[data-testid="firstName"]',
    value: 'test',
  },
  {
    action: 'type',
    selector: '[data-testid="lastName"]',
    value: 'update',
  },
  {
    action: 'type',
    selector: '[data-testid="email"]',
    value: 'testupdate@drc.org',
  },
  {
    action: 'click',
    selector: '[data-testid="updateprofile"]',
  },
  {
    action: 'click',
    selector: ":contains('Security Setting')",
  },
  {
    action: 'type',
    selector: '[data-testid="newpassword"]',
    value: '1234@Drec',
  },
  {
    action: 'type',
    selector: '[data-testid="confirmPassword"]',
    value: '1234@Drc',
  },
  {
    action: 'click',
    selector: '[data-testid="resetpasswordform"]',
  }
]
