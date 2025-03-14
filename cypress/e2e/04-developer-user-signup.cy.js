import clearDatabase from '../support/commands/clear-database'
import developerUserSignup from '../support/commands/developer-user-signup'

describe('Sign up Test', () => {
  beforeEach(() => {
    cy.wait(5000);
    // cy.clearDatabase();
  });

  it('should sign up a new developer user', () => {
    cy.developerUserSignup();
  });
});
