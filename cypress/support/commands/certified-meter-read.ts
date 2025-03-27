import 'cypress-file-upload';

Cypress.Commands.add('certifiedMeterRead', function () {
  cy.fixture('certified-meter-read.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          return cy.get(step.selector).click().wait(1000);
        case 'select':
          cy.get(step.selector).click({ force: true });
          return cy.get('body').then(($body) => {
            switch ($body.find(step.option).length > 0) {
              case true:
                return cy
                  .get(step.option)
                  .should('have.length.greaterThan', 0)
                  .eq(0)
                  .click('center', { force: true });
              default:
                cy.get('[test-id="country-dropdown-no-selection"]').click({
                  force: true,
                });
                cy.get('[test-id="filter-certified-meter-read"]').click({
                  force: true,
                });
                cy.get('[test-id="no-certified-meter-read"]', { timeout: 5000 })
                  .should('be.visible')
                  .should('contain', 'No Certificate');
            }
          });
      }
    });
  });
});
