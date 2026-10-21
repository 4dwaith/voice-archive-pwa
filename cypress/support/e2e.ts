import '@testing-library/cypress/add-commands'
import '@cypress/code-coverage/support'

// Contract failures are expected console errors, never uncaught exceptions.
// Leave Cypress's normal uncaught-exception failure behavior enabled.
