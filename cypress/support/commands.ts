/// <reference types="cypress" />
import 'cypress-file-upload';
const ADMIN_EMAIL = Cypress.env('ADMIN_EMAIL');
const ADMIN_PASSWORD = Cypress.env('ADMIN_PASSWORD');
const REACT_APP_BACKEND_URL = Cypress.env('REACT_APP_BACKEND_URL');
const UI_BASE_URL = Cypress.env('UI_BASE_URL');
import 'cypress-file-upload';

Cypress.Commands.add<any>('clearDatabase', () => {
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

Cypress.Commands.add<any>('developerUserSignup', function () {
  cy.fixture('developer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();
    data.forEach((step) => {
      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .type(step.value)
          .should('have.value', step.value);
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

Cypress.Commands.add<any>('buyerUserSignup', function () {
  cy.fixture('buyer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();
    data.forEach((step) => {
      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .type(step.value)
          .should('have.value', step.value);
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

Cypress.Commands.add<any>('adminLogin', function () {
  cy.fixture('admin-login.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);

    data.forEach((step) => {
      if (step.action === 'type') {
        cy.get(step.selector).type(
          step.index === 0 ? ADMIN_EMAIL : ADMIN_PASSWORD,
        );
      }
      if (step.action === 'click') {
        cy.get(step.selector).click();
        if (step.selector === '[test-id="login-submit"]') {
          cy.contains('Login Success').should('be.visible');
          cy.contains(`Login user ${ADMIN_EMAIL}`).should('be.visible');
        }
      }
    });
  });
});

Cypress.Commands.add<any>('buyerUserPermissionsSetup', function () {
  cy.fixture('buyer-user-permissions-setup.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).wait(10000).should('be.visible').click();
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click()
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(3)
          .click()
          .wait(1000);
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

Cypress.Commands.add<any>('developerUserPermissionsSetup', function () {
  cy.fixture('developer-user-permissions-setup.json').then((data) => {
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
          .click()
          .wait(1000);
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

Cypress.Commands.add<any>('addDevice', function () {
  cy.fixture('add-device.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'type') {
        return cy.get(step.selector).should('be.visible').type(step.value);
      }

      if (step.action === 'write') {
        return cy
          .get(step.selector)
          .should('be.visible')
          .clear()
          .type(step.value + '{enter}');
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click()
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(0)
          .click();
      }
      if (step.action === 'submit') {
        return cy.get(step.selector).click('center', { force: true });
      }
    });
  });
});

Cypress.Commands.add<any>('addHistoryMeterRead', function () {
  cy.fixture('add-history-meter-read.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'selected') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .wait(1000)
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .first()
          .should('be.visible')
          .click({ force: true })
          .wait(1000);
      }
      if (step.action === 'select-timezone') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(0)
          .click('center', { force: true });
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(0)
          .click('center', { force: true });
      }

      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .wait(1000)
          .click({ force: true })
          .type(step.value, { force: true });
      }
      if (step.action === 'start-date') {
        return cy
          .get(step.selector)
          .eq(0)
          .click('center', { force: true })
          .get(step.option)
          .eq(0)
          .click()
          .get('.mat-stroked-button')
          .click();
      }
      if (step.action === 'end-date') {
        return cy
          .get(step.selector)
          .eq(1)
          .click('center', { force: true })
          .get(step.option)
          .eq(5)
          .click()
          .get('.mat-stroked-button')
          .click();
      }
    });
  });
});

Cypress.Commands.add<any>('addDeltaMeterRead', function () {
  cy.fixture('add-delta-meter-read.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'selected') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .wait(1000)
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .first()
          .should('be.visible')
          .click({ force: true })
          .wait(1000);
      }
      if (step.action === 'select-timezone') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(0)
          .click('center', { force: true });
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(1)
          .click('center', { force: true });
      }

      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .wait(1000)
          .click({ force: true })
          .type(step.value, { force: true });
      }
      if (step.action === 'date-picker') {
        const currentTime = new Date();
        currentTime.setHours(currentTime.getHours() + 2);

        const formattedTime = currentTime.toLocaleString('en-US', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

        return cy
          .get(step.selector)
          .wait(1000)
          .click({ force: true })
          .type(formattedTime, { force: true })
          .click();
      }
    });
  });
});

Cypress.Commands.add<any>('addAggregateMeterRead', function () {
  cy.fixture('add-aggregate-meter-read.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'selected') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .wait(1000)
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .first()
          .should('be.visible')
          .click({ force: true })
          .wait(1000);
      }
      if (step.action === 'select-timezone') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(0)
          .click('center', { force: true });
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(2)
          .click('center', { force: true });
      }

      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .wait(1000)
          .click({ force: true })
          .type(step.value, { force: true });
      }
      if (step.action === 'date-picker') {
        const currentTime = new Date();
        currentTime.setHours(currentTime.getHours() + 2);

        const formattedTime = currentTime.toLocaleString('en-US', {
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        });

        return cy
          .get(step.selector)
          .wait(1000)
          .click({ force: true })
          .type(formattedTime, { force: true })
          .click();
      }
    });
  });
});

Cypress.Commands.add<any>('buyerUserLogin', function () {
  cy.fixture('buyer-user-login.json').then((data) => {
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

Cypress.Commands.add<any>('addReservation', function () {
  cy.fixture('add-reservation.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .should('be.visible')
          .type(step.value, { force: true });
      }
      if (step.action === 'select') {
        return cy
          .get(step.selector)
          .click({ force: true })
          .get(step.option)
          .should('have.length.greaterThan', 0)
          .eq(0)
          .click('center', { force: true });
      }
      if (step.action === 'check') {
        return cy.get(step.selector).wait(1000).eq(step.index).click();
      }
    });
  });
});

Cypress.Commands.add<any>('developerUserLogin', function () {
  cy.fixture('developer-user-login.json').then((data) => {
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

Cypress.Commands.add<any>('buyerUserLogin', function () {
  cy.fixture('buyer-user-login.json').then((data) => {
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

Cypress.Commands.add<any>('certificate', function () {
  cy.fixture('certificate.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .should('be.visible')
          .type(step.value, { force: true });
      }
    });
  });
});

Cypress.Commands.add<any>('bulkUpload', function () {
  cy.fixture('bulk-upload.json').then((data) => {
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

Cypress.Commands.add<any>('certificateFilter', function () {
  cy.fixture('certificate-filter.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'select') {
        cy.get(step.selector).click({ force: true });
        cy.get('body').then(($body) => {
          if ($body.find(step.option).length > 0) {
            cy.get(step.option)
              .should('have.length.greaterThan', 0)
              .eq(0)
              .click('center', { force: true });
            cy.get('[test-id="filter-button"]').click({ force: true });
          } else {
            cy.get('[test-id="dropdown-no-selection"]').click({ force: true });
            cy.get('[test-id="filter-button"]').click({ force: true });
            cy.get('[test-id="no-certificate"]', { timeout: 5000 })
              .should('be.visible')
              .should('contain', 'No Certificate');
          }
        });
      }
    });
  });
});

Cypress.Commands.add<any>('accountSettings', function () {
  cy.fixture('account-settings.json').then((data) => {
    data.forEach((step) => {
      if (step.action === 'click') {
        return cy.get(step.selector).click().wait(1000);
      }
      if (step.action === 'type') {
        return cy
          .get(step.selector)
          .should('be.visible')
          .clear({ force: true })
          .type(step.value, { force: true });
      }
    });
  });
});
