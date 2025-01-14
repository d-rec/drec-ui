describe('Add divice Test', () => {
    beforeEach(()=>{
      cy.wait(1000);
    })
    it('should add new divice', () => {
      cy.dev-login().wait(6000);
      cy.add-device();
    });
  });