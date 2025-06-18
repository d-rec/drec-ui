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
            .attachFile('files/d-rec-device-bulk-upload-template.csv', {
              force: true,
            });

        case 'upload-bulk':
          return cy
            .get(step.selector)
            .scrollIntoView()
            .should('be.visible')
            .click()
            .wait(1000);
      }
    });
  });
});
