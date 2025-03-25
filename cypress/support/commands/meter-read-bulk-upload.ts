Cypress.Commands.add('meterReadBulkUpload', function () {
  cy.fixture('meter-read-bulk-upload.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).click().wait(1000);
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
