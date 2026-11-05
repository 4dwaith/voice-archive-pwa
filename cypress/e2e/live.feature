Feature: Live voice conversation
  Scenario: Stop and reload preserve the conversation until discard
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    And Live provides resumable checkpoints
    When I start Live from the library
    Then Live exchanges browser audio
    When I stop Live
    Then Live has released the microphone
    When I reload the Live app
    Then Live waits for explicit continuation
    When I continue Live
    Then Live resumes the same conversation
    When I stop Live
    And I discard the Live conversation
    Then Live offers a fresh conversation

  Scenario: A non-resumable checkpoint explains the fresh start
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    And Live provides resumable checkpoints
    When I start Live from the library
    Then Live exchanges browser audio
    When the Live checkpoint becomes unavailable
    And I stop Live
    Then Live offers a fresh conversation
    And Live has released the microphone

  Scenario: Live stays available while reading and stops before narration
    Given a synchronization book with narration after untimed text
    And its narrated text spans pages
    And a synthetic Live audio provider
    When I start Live from the library
    Then Live exchanges browser audio
    When I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    And I focus the text and hide the controls
    Then the corner Live control remains reachable
    When I play the page narration
    Then Live has released the microphone
    When I start Live from the narration modal
    Then narration stops and the modal closes
    When I stop Live
    Then Live has released the microphone

  Scenario: Provisioning failure releases the microphone and allows retry
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    And Live provisioning fails once
    When I start Live from the library
    Then Live reports failure and releases the microphone
    When I retry Live
    Then Live exchanges browser audio
    When I stop Live
    Then Live has released the microphone
