# Supervisor Task Pop-ups

## Goal
Make every report action open its information immediately, without requiring the supervisor to scroll down the page.

## Changes
- Replace the bottom-opening assignment sheet with a centered, screen-aware pop-up.
- Show the available worker names at the top of the pop-up, with online workers first.
- Keep the report summary compact and keep the confirmation button fixed at the bottom while only the worker list scrolls when necessary.
- Apply the same centered pop-up behavior to Reassign and View Proof.
- Preserve the current Supervisor styling, task logic, notifications, and all other roles.

## Verification
- Test Assign, Reassign, View Proof, close controls, worker selection, and small-screen behavior.
- Confirm the current build remains error-free.
