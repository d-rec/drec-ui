import developerUserLogin from '../support/commands/developer-user-login'
import addAggregateMeterRead from '../support/commands/add-aggregate-meter-reads'

describe('Add aggregate Meter Read', () => {
    beforeEach(() => {
      cy.wait(1000);
    });
    it('should add aggregate meter Read', () => {
      cy.developerUserLogin().wait(20000);
      cy.addAggregateMeterRead();
    });
  });
  