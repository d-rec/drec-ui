const ADMIN_EMAIL = Cypress.env('ADMIN_EMAIL');
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD');
const REACT_APP_BACKEND_URL = Cypress.env('REACT_APP_BACKEND_URL');
const UI_BASE_URL = Cypress.env('UI_BASE_URL');

Cypress.Commands.add('clearDatabase', () => {
  cy.request({
    method: 'DELETE',
    url: `${REACT_APP_BACKEND_URL}/api/testing/clear-db`,
    failOnStatusCode: false,
    timeout: 10000,
  }).then((response) => {
    if (response.status === 200) {
      cy.log('Database cleared successfully');
    } else {
      cy.log(
        `Failed to clear database: ${response.body.error || 'Unknown error'}`,
      );
    }
  });
});

Cypress.Commands.add('signup', function () {
  cy.fixture('signup.js').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[data-testid="register"]').click();
    data.forEach((step) => {
      if (step.action === 'type') {
        return cy.get(step.selector).type(step.value);
      }
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click()
          .then(() => {
            cy.get('mat-option').contains(step.value).click();
          });
      }
    });
  });
});

Cypress.Commands.add('admin_login', function () {
  cy.fixture('admin_login.js').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    data.forEach((step) => {
      if (step.action === 'type') {
        if (step.index === 0) {
          return cy.get(step.selector).type(ADMIN_EMAIL);
        }
        if (step.index === 1) {
          return cy.get(step.selector).type(ADMIN_PASSWORD);
        }
      }
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
    });
  });
});

Cypress.Commands.add('permissions', function () {
  cy.fixture('permissions.js').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).should('be.visible').click().wait(1000);
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click()
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(1)
          .click();
      }
      if (step.action === 'check') {
        return cy.get(step.selector).eq(step.index).click();
      }
      if (step.action === 'check-multiple') {
        return cy.contains('table tr', step.contains).within(() => {
          cy.get(step.selector).each(($el) => {
            cy.wrap($el).click();
          });
        });
      }
      if (step.action === 'submit') {
        return cy
          .get(step.selector)
          .scrollIntoView()
          .should('be.visible')
          .click();
      }
    });
  });
});

Cypress.Commands.add('add_device', function () {
  cy.fixture('add_device.js').then((data) => {
    data.forEach((step) => {
    if (step.action === "click") {
      return cy.get(step.selector).click().wait(1000);
    }
    if (step.action === "type") {
      return cy.get(step.selector).should('be.visible').type(step.value);
    }
    
    if (step.action === "write") {
      return cy.get(step.selector)
      .should('be.visible') 
      .clear()              
      .type(step.value + '{enter}'); 
        }
    if (step.action === "select") {
      return cy.get(step.selector).click()
        .get(step.option) 
        .should('have.length.greaterThan', 0) 
        .eq(0)
        .click(); 
    }
    if (step.action === "submit") {
      return cy.get(step.selector).click('center', { force: true });
    }
  });
  });
});

Cypress.Commands.add('dev_login', function () {
  cy.fixture('dev_login.js').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    data.forEach((step) => {
      if (step.action === 'type') {
        return cy.get(step.selector).type(step.value);
      }

      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
    });
  });
});

Cypress.Commands.add('buyer_login', function () {
  cy.fixture('buyer_login.js').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    data.forEach((step) => {
      if (step.action === 'type') {
        return cy.get(step.selector).type(step.value);
      }

      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
    });
  });
});
