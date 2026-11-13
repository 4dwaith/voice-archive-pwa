import '@testing-library/cypress/add-commands'
import '@cypress/code-coverage/support'
import { requestApi } from './api'

beforeEach(() => {
  if (Cypress.expose('mode') === 'live') {
    cy.session(
      'reader',
      () =>
        requestApi('POST', `${Cypress.expose('apiUrl')}/api/v1/auth/login`, {
          email: 'reader@example.com',
          password: 'e2e-password',
        }),
      { cacheAcrossSpecs: true },
    )
  } else {
    cy.intercept('GET', '**/api/v1/auth/me', {
      body: { id: 2, email: 'reader@example.com', display_name: null },
    })
  }
  // Reset on the app's origin before starting it. Reloads inside a scenario keep data.
  cy.intercept(
    { method: 'GET', pathname: '/__cypress_reset', times: 1 },
    {
      headers: { 'content-type': 'text/html' },
      body: '<!doctype html><html lang="en"></html>',
    },
  )
  cy.visit('/__cypress_reset')
  cy.window().then(
    (win) =>
      new Cypress.Promise<void>((resolve, reject) => {
        win.localStorage.clear()
        win.sessionStorage.clear()
        const request = win.indexedDB.deleteDatabase('voice-archive-e2e-test')
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
        request.onblocked = () =>
          reject(new Error('The test database is still in use.'))
      }),
  )
})

// Contract failures are expected console errors, never uncaught exceptions.
// Leave Cypress's normal uncaught-exception failure behavior enabled.
