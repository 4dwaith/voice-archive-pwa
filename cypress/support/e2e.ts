import '@testing-library/cypress/add-commands'
import '@cypress/code-coverage/support'

beforeEach(() => {
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
