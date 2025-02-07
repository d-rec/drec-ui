describe('Bulk Upload Test', () => {
    beforeEach(() => {
        cy.wait(1000);
      });
    it('should upload a file', () => {
      cy.developerUserLogin().wait(60000);
      cy.bulkUpload('device-bulk-upload-template'); 
    });
  });
  