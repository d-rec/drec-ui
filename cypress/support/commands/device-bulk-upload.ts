import 'cypress-file-upload';

Cypress.Commands.add('deviceBulkUpload', function () {
  cy.fixture('device-bulk-upload.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).click();
          break;
        case 'upload':
          cy.get(step.selector).attachFile(
            'files/d-rec_bulk_upload_meter_read_template.csv',
            {
              force: true,
            },
          );
      }
    });
  });
});
