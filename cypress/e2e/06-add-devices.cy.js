import addDevice from '../support/commands/add-device'
import developerUserLogin from '../support/commands/developer-user-login'

describe('Add device Test', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should add new device', () => {
    cy.developerUserLogin().wait(6000);
    cy.addDevice();
  });
});
