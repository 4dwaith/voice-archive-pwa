Feature: Sign-in and guest access
  Visitors can read public books without an account.
  Signing in identifies the reader and enables Live conversation.

  @live
  Scenario: Sign in and sign out
    Given I have not signed in
    When I sign in with my email and password
    Then my email is shown in the header
    When I sign out
    Then I am browsing as a guest
    And Live conversation is unavailable

  @live
  Scenario: An incorrect password is explained
    Given I have not signed in
    When I try to sign in with the wrong password
    Then I am told that sign-in failed

  Scenario: Reading a public book without signing in
    Given I have not signed in
    And a public book is available in the library
    When I start reading the public book
    Then I see its first reader page
    And Live conversation is unavailable

  @live
  Scenario: Returning after my sign-in has expired
    Given I am signed in
    When I return to the app after my sign-in expires
    Then I am asked to sign in again

  @mock
  Scenario: Sign-in explains the demo restrictions
    Given I have not signed in
    And sign-in is disabled
    When I request to sign in
    Then the demo restrictions explain how to set up locally
    When I continue without signing in
    Then I am browsing as a guest
    And Live conversation is unavailable
