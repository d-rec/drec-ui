describe('Add late ongoing meter Read', () => {
    beforeEach(() => {
      cy.wait(1000);
    });
    it('Add late ongoing meter Read', () => {
      cy.developerUserLogin().wait(20000);
      cy.lateOngoingMeterRead();
    });
  });
  