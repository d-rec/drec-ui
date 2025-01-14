describe('Add reservation', () => {
    beforeEach(()=>{
      cy.wait(1000);
    })
    it('should add reservation', () => {
      cy.buyer-login().wait(20000);
      cy.add-reservation();
    });
  });