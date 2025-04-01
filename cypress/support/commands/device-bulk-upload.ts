import 'cypress-file-upload';

Cypress.Commands.add('deviceBulkUpload', function () {
  cy.fixture('device-bulk-upload.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).click().wait(1000);
        case 'upload':
          return cy
            .get(step.selector)
            .attachFile('files/d-rec_bulk_upload_meter_read_template.csv', {
              force: true,
            });
        case 'upload-bulk':
          cy.get(step.selector).click('center', { force: true });
          return cy.contains('Successfully!').should('be.visible');
      }
    });
  });
});
