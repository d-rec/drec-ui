import 'cypress-file-upload';
const UI_BASE_URL = Cypress.env('UI_BASE_URL');
// No longer need mailisk-specific email
const testEmailAddress = `test4@example.com`;

// We'll add this variable to store the verification code
let mockVerificationCode = '123456';

// Remove dependency check for MAILISK variables
before(() => {
  // Check required environment variables
  ['UI_BASE_URL'].forEach((envVar) => {
    if (!Cypress.env(envVar)) {
      throw new Error(`Required environment variable not set: ${envVar}`);
    }
  });
  cy.log(`Using email: ${testEmailAddress}`);
});

// Setup route interception for verification code API request
Cypress.Commands.add('setupEmailVerificationMock', () => {
  // Intercept the API call that would normally send a verification email
  cy.intercept('POST', '**/auth/send-verification*', (req) => {
    // Log the interception for debugging
    cy.log('Intercepted verification code request');

    // Generate a random 6-digit code for testing
    mockVerificationCode = Math.floor(
      100000 + Math.random() * 900000,
    ).toString();
    cy.log(`Generated mock verification code: ${mockVerificationCode}`);

    // Return a successful response
    req.reply({
      statusCode: 200,
      body: {
        success: true,
        message: 'Verification code sent successfully',
      },
    });
  }).as('sendVerificationCode');

  // Intercept the API call that verifies the code
  cy.intercept('POST', '**/auth/verify*', (req) => {
    cy.log('Intercepted verification code validation');

    // Check if the submitted code matches our mock code
    const submittedCode = req.body.code || '';

    if (submittedCode === mockVerificationCode) {
      req.reply({
        statusCode: 200,
        body: {
          success: true,
          token: 'mock-jwt-token',
          message: 'Verification successful',
        },
      });
    } else {
      req.reply({
        statusCode: 400,
        body: {
          success: false,
          message: 'Invalid verification code',
        },
      });
    }
  }).as('verifyCode');
});

Cypress.Commands.add('developerUserSignup', function () {
  // Setup our mocks first
  cy.setupEmailVerificationMock();

  cy.fixture('developer-user-signup.json').then((data) => {
    cy.visit(`${UI_BASE_URL}/login`).wait(1000);
    cy.get('[test-id="register"]').click();

    data.forEach((step) => {
      switch (step.action) {
        case 'type':
          if (step.selector === "[test-id='email']") {
            return cy
              .get(step.selector)
              .type(testEmailAddress)
              .should('have.value', testEmailAddress);
          }
          return cy
            .get(step.selector)
            .type(step.value)
            .should('have.value', step.value);
        case 'click':
          return cy.get(step.selector).click().wait(1000);
        case 'select':
          return cy
            .get(step.selector)
            .click()
            .then(() => {
              cy.get('mat-option').contains(step.value).click();
            })
            .wait(2000);
      }
    });

    // Add more detailed logging before checking the page state
    cy.log('Registration form submitted, checking current page state');

    // Wait longer for redirects and page updates
    cy.wait(8000);

    // Log the current URL for debugging
    cy.url().then((url) => {
      cy.log(`Current URL: ${url}`);
    });

    // Add an explicit wait for the page to fully load
    cy.document().should('have.property', 'readyState', 'complete');

    // Add more debug information
    cy.get('body').then(($body) => {
      // More detailed body logging
      cy.log('Current page content preview:', $body.text().substring(0, 500));
      cy.log(
        'Visible elements:',
        Object.keys($body.find('*[test-id]')).join(', '),
      );

      // Attempt to capture and log any visible error messages on the page
      if ($body.find('.error-message, .alert, [role="alert"]').length > 0) {
        cy.log(
          'Found error elements:',
          $body.find('.error-message, .alert, [role="alert"]').text(),
        );
      }

      // Check for various possible states with more conditions
      if (
        $body.find(
          '#code, [test-id="verification-code"], input[placeholder*="code"], [name="code"]',
        ).length > 0 ||
        $body.text().toLowerCase().includes('verification code') ||
        $body.text().toLowerCase().includes('verify your email')
      ) {
        cy.log('✅ On verification code page, using mock verification code');

        // Find the email field more flexible

        // Find the code input field more flexibly
        cy.get(
          '#code, [test-id="verification-code"], [name="code"], input[placeholder*="code"]',
        )
          .first()
          .type(mockVerificationCode);

        // Find and click the submit button
        cy.get(
          'button[type="submit"], [test-id="submit"], button:contains("Verify")',
        )
          .first()
          .click();

        // Wait for verification API call to complete, with a timeout
        cy.wait('@verifyCode', { timeout: 15000 })
          .its('response.statusCode')
          .should('eq', 200);

        // Check if we're redirected to dashboard with a longer timeout
        cy.location('pathname', { timeout: 20000 }).should(
          'include',
          '/dashboard',
        );
      } else if (
        $body.text().toLowerCase().includes('dashboard') ||
        $body.find('[test-id="dashboard"], .dashboard').length > 0 ||
        cy.url().should('include', '/dashboard')
      ) {
        cy.log(
          '✅ Already redirected to dashboard, registration successful without verification',
        );
        // Success case - we're on the dashboard
      } else {
        // More detailed diagnostic information about the current page
        cy.location('pathname').then((path) => {
          cy.log(`Current path: ${path}`);

          // Try to identify form elements that might be waiting for input
          const formElements = $body.find('form, input, button[type="submit"]');
          if (formElements.length > 0) {
            cy.log(
              'Found form elements that might require input:',
              formElements
                .map(
                  (_, el) =>
                    $(el).attr('test-id') ||
                    $(el).attr('name') ||
                    $(el).attr('id'),
                )
                .get()
                .join(', '),
            );
          }

          // Check for common error messages with more patterns
          const errorMessages = [
            'already exists',
            'invalid email',
            'required field',
            'error',
            'failed',
            'try again',
            'incorrect',
            'not allowed',
          ];

          const foundErrors = errorMessages.filter((msg) =>
            $body.text().toLowerCase().includes(msg.toLowerCase()),
          );

          if (foundErrors.length > 0) {
            cy.log(`❌ Found error messages: ${foundErrors.join(', ')}`);
            throw new Error(`Registration failed: ${foundErrors.join(', ')}`);
          } else if (
            path.includes('/login') ||
            path.includes('/signup') ||
            path.includes('/register')
          ) {
            cy.log(
              '❌ Still on login/registration page, form submission may have failed',
            );
            throw new Error(
              'Form submission did not redirect - check for validation errors or failed API calls',
            );
          } else {
            cy.log('❓ Registration form submission led to an unexpected page');
            throw new Error(
              `Registration form submission led to unexpected page: ${path}`,
            );
          }
        });
      }
    });
  });
});
