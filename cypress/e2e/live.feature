Feature: Live voice conversation
  Scenario: A book answer leads to its supporting passage
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    And the book answer is "available"
    When I start Live from the library
    And I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    And I use the header Home button
    And I ask Live about the nested destination
    Then Live receives the grounded answer and supporting passage
    When I ask Live to open the supporting passage
    Then I see the nested section text
    When I stop Live
    Then Live has released the microphone

  Scenario: An outdated answer reference cannot open another version
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    And the book answer is "outdated"
    When I start Live from the library
    And I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    And I use the header Home button
    And I ask Live about the nested destination
    Then Live receives the grounded answer and supporting passage
    When I ask Live to open the supporting passage
    Then Live explains that the supporting version is unavailable
    When I stop Live
    Then Live has released the microphone

  Scenario: An unavailable book answer keeps its qualification
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    And the book answer is "unavailable"
    And book content requests are observed
    When I start Live from the library
    And I ask Live about the nested destination
    Then Live receives the answer unavailability and its limitation
    And Live has not opened or downloaded the book
    When I stop Live
    Then Live has released the microphone

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

  Scenario: Live changes settings, moves one page and returns Home
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    When I start Live from the library
    And I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    Then I see its first reader page
    When Live calls "setTextSize" with ID "size" and arguments '{"percent":112.5}'
    And Live calls "getReaderSettings" with ID "size-read"
    Then tool "size-read" reports "textSizePercent" as "112.5"
    When Live calls "moveTextPage" with ID "move" and arguments '{"direction":"next"}'
    Then the text shows page 2
    When Live calls "goHome" with ID "home"
    Then I return to the synchronization library
    When Live calls "moveTextPage" with ID "invalid-move" and arguments '{"direction":"next"}'
    Then Live receives one command failure
    When I stop Live
    Then Live has released the microphone

  Scenario: Live opens an undownloaded book and its reader loads automatically
    Given a synchronization book with a slow second batch
    And a synthetic Live audio provider
    When I start Live from the library
    Then Live exchanges browser audio
    When Live calls "openBook" with ID "open-new" and arguments '{"bookId":7}'
    Then its first batch is readable without marking the book complete
    When I wait for book synchronization to finish
    Then I see its first reader page
    And Live exchanges browser audio
    When I stop Live
    Then Live has released the microphone

  Scenario: Live opens cached nested and exact segment destinations from the library
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    When I start Live from the library
    And I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    And I use the header Home button
    Then I return to the synchronization library
    When Live calls "navigateToSection" with ID "nested" and arguments '{"bookId":7,"contentVersion":"a3027b66-924c-4c9a-aad5-660ba7a733bc","sectionId":2}'
    Then I see the nested section text
    When I use the header Home button
    Then I return to the synchronization library
    When Live calls "navigateToSegment" with ID "exact" and arguments '{"bookId":7,"contentVersion":"a3027b66-924c-4c9a-aad5-660ba7a733bc","segmentId":2,"offset":0}'
    Then I see the nested section text
    When I use the header Home button
    Then I return to the synchronization library
    When Live calls "openBook" with ID "open" and arguments '{"bookId":7,"contentVersion":"a3027b66-924c-4c9a-aad5-660ba7a733bc"}'
    Then I see the nested section text
    When I stop Live
    Then Live has released the microphone

  Scenario: Live plays the selected passage in the open book
    Given a synchronization book with narration after untimed text
    And a synthetic Live audio provider
    And its narrated text spans pages
    When I start Live from the library
    And I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    And I focus the text and hide the controls
    And I select a text segment
    Then the text segment is selected
    When Live calls "getReadingPosition" with ID "selected-position"
    Then tool "selected-position" reports "status" as "ready"
    When I ask Live to play the selected passage
    Then Live has released the microphone
    And turner narration is playing

  Scenario: Live opens a cached narration destination and yields to playback
    Given a synchronization book with narration after untimed text
    And a synthetic Live audio provider
    And its narrated text spans pages
    When I start Live from the library
    And I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    And I use the header Home button
    Then I return to the synchronization library
    When Live calls "startPlayback" with ID "read" and arguments '{"destination":{"bookId":7,"contentVersion":"a3027b66-924c-4c9a-aad5-660ba7a733bc","target":"section","sectionId":1}}'
    Then Live has released the microphone
    And turner narration is playing

  Scenario: Voice changes speaking speed and reveals reading controls
    Given a synchronization book with a nested destination
    And a synthetic Live audio provider
    When I start Live from the library
    And I enter the synchronization reader during Live
    And I wait for book synchronization to finish
    And I set narration speed to 1.25 through Live
    Then the speaking speed is 1.25 times normal
    When I ask Live to speak faster by one step
    Then the speaking speed is 1.30 times normal
    When I decrease speaking speed using the header
    Then the speaking speed is 1.25 times normal
    When I toggle the reading controls through Live
    Then the reading controls are hidden
    When I toggle the reading controls through Live
    Then the reading controls are visible
    When I reload the reader
    Then the speaking speed is 1.25 times normal

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
