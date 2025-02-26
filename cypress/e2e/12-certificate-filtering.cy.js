describe('Filter certificates', () => {
    beforeEach(() => {
      cy.wait(1000);
    });
    it('should filter certificates', () => {
      cy.buyerUserLogin().wait(20000);
      cy.certificateFilter();
    });
  });
  