describe('Bulk Upload Test', () => {
  beforeEach(() => {
    cy.wait(1000);
  });
  it('should upload a file', () => {
    // cy.developerUserLogin().wait(30000);
    cy.adminLogin().wait(20000);
    cy.deviceBulkUpload('device-bulk-upload-template');
  });
});
