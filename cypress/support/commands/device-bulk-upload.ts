import 'cypress-file-upload';

Cypress.Commands.add('deviceBulkUpload', function () {
  cy.fixture('device-bulk-upload.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'upload') {
        cy.get(step.selector)
          .attachFile('files/d-rec_bulk_upload_meter_read_template.csv', {
            force: true,
          })
          .wait(5000);
      }
    });
  });
});
