import 'cypress-file-upload';

Cypress.Commands.add('certificateFilter', function () {
  cy.fixture('certificate-filter.json').then((data) => {
    data.forEach((step) => {
      switch (step.action) {
        case 'click':
          cy.get(step.selector).click();
          break;
        case 'select':
          cy.get(step.selector).click({ force: true });
          cy.get('body').then(($body) => {
            switch ($body.find(step.option).length > 0) {
              case true:
                cy.get(step.option)
                  .should('have.length.greaterThan', 0)
                  .eq(0)
                  .click('center', { force: true });
                cy.get('[test-id="filter-button"]').click({ force: true });
                break;
              case false:
                cy.get('[test-id="dropdown-no-selection"]').click({
                  force: true,
                });
                cy.get('[test-id="filter-button"]').click({ force: true });

                cy.get('[test-id="no-certificate"]', { timeout: 5000 })
                  .should('exist')
                  .then(($el) => {
                    switch ($el.is(':visible')) {
                      case true:
                        cy.wrap($el).should('contain', 'No Certificate');
                        break;
                    }
                  });
                break;
            }
          });
      }
    });
  });
});
