Feature: Live voice conversation
  Scenario: The turner starts and stops Live from the library
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    When I open the turner test library
    And I press the turner "MediaTrackPrevious" key
    And I press the turner "MediaTrackNext" key
    Then Live offers a fresh conversation
    When I press the turner "MediaPlay" key
    Then Live exchanges browser audio
    When I press the turner "MediaPlay" key
    Then Live has released the microphone

  Scenario: Turner controls coordinate narration, Live and PDF
    Given a synchronization book with narration after untimed text
    And its narrated text spans pages
    And a synthetic Live audio provider
    When I open the synchronization book from the library
    And I wait for book synchronization to finish
    And I focus the Live control
    And I press the turner "MediaPlay" key
    Then Live exchanges browser audio
    When I focus the Live control
    And I press the turner "MediaTrackPrevious" key
    Then Live has released the microphone
    And turner narration is playing
    When I press the turner "MediaTrackPrevious" key
    Then turner narration is paused
    When I focus the Live control
    And I press the turner "MediaTrackPrevious" key
    Then turner narration is playing
    When I press the turner "MediaPlay" key
    Then narration stops and the modal closes
    When I focus the Live control
    And I press the turner "MediaTrackNext" key
    Then only the PDF surface is open
    When I press the turner "MediaTrackPrevious" key
    Then Live exchanges browser audio
    And turner narration is paused
    When I press the turner "MediaPlay" key
    Then Live has released the microphone
    When I press the turner "MediaTrackNext" key
    Then the turner restores Text mode

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
    When I press the turner "MediaPlay" key
    Then Live exchanges browser audio
    When I press the turner "MediaPlay" key
    Then Live has released the microphone

  Scenario: Discard returns focus so every turner gesture still works
    Given a synchronization book with narration after untimed text
    And its narrated text spans pages
    And a synthetic Live audio provider
    And Live provides resumable checkpoints
    When I start Live from the library
    Then Live exchanges browser audio
    When I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    And I focus the text and hide the controls
    And I stop Live
    And I tap Discard on the touchscreen
    Then Live offers a fresh conversation
    And the reader has keyboard focus
    And the reader controls are hidden
    When I press the turner "MediaPlay" key
    Then Live exchanges browser audio
    When I press the turner "MediaPlay" key
    Then Live has released the microphone
    When I press the turner "MediaTrackNext" key
    Then only the PDF surface is open
    When I press the turner "MediaTrackNext" key
    Then the turner restores Text mode
    When I press the turner "MediaTrackPrevious" key
    Then turner narration is playing

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

  Scenario: Live stays available while reading and closes quietly on narration
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

  Scenario: Live reads current settings after a manual change
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    When I start Live from the library
    Then Live exchanges browser audio
    When Live calls "getAppLocation" with ID "library"
    Then tool "library" reports "reader" as "unavailable"
    When I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    And I focus the text and hide the controls
    And I press the turner "MediaTrackNext" key
    Then only the PDF surface is open
    When Live calls "getReaderSettings" with ID "settings"
    Then tool "settings" reports "viewMode" as "pdf"
    When I stop Live
    Then Live has released the microphone

  Scenario: Voice End releases capture and is not replayed after reload
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    And Live provides resumable checkpoints
    When I start Live from the library
    Then Live exchanges browser audio
    When Live calls "endLiveSession" with ID "end"
    Then Live has released the microphone
    When I reload the Live app
    And I continue Live
    Then Live resumes the same conversation
    When Live calls "endLiveSession" with ID "end"
    Then tool "end" reports "accepted" as "true"
    And Live resumes the same conversation
    When I stop Live
    Then Live has released the microphone

  Scenario: Live reports missing local content without downloading
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    And book content requests are observed
    When I start Live from the library
    And Live calls "listAvailableBooks" with ID "catalog"
    Then tool "catalog" reports "total" as "1"
    When Live calls "getBookInfo" with ID "info" and arguments '{"bookId":7}'
    Then tool "info" reports "identitySource" as "unavailable"
    When Live calls "getBookToc" with ID "toc" and arguments '{"bookId":7,"contentVersion":"a3027b66-924c-4c9a-aad5-660ba7a733bc"}'
    Then tool "toc" reports "status" as "unavailable"
    And Live has not opened or downloaded the book
    When I stop Live
    Then Live has released the microphone

  Scenario: Live reads nearby Text without navigating
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    When I start Live from the library
    And Live calls "getTextPage" with ID "absent" and arguments '{"offset":0}'
    Then tool "absent" reports "status" as "unavailable"
    When I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    Then I see its first reader page
    When Live calls "getReadingPosition" with ID "before"
    And Live calls "getTextPage" with ID "adjacent" and arguments '{"offset":1}'
    Then tool "adjacent" reports "status" as "ready"
    And I see its first reader page
    When I stop Live
    Then Live has released the microphone

  Rule: Playback handoff keeps Live available until narration starts
    Background:
      Given a synchronization book with narration after untimed text
      And a synthetic Live audio provider
      And its narrated text spans pages
      And narration Play is delayed
      When I start Live from the library
      Then Live exchanges browser audio
      When I enter the synchronization reader during Live
      And I wait for book synchronization to finish
      And I play the page narration
      Then Live waits silently for narration

    Scenario: Slow Play closes Live only after actual playback
      When delayed narration "plays"
      Then Live has released the microphone
      And turner narration is playing

    Scenario: Rejected Play explains the error on the existing connection
      When delayed narration "fails"
      Then Live receives the playback failure once

    Scenario: Pause cancels delayed Play without restarting Live
      When I cancel delayed narration
      Then Live continues without delayed narration
