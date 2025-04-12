# Memrise Speed & Pause Control

Memrise Speed & Pause Control is a browser extension that allows you to control playback speed and pause/resume during Memrise Speed Reviews. It provides an intuitive UI for adjusting speed, pausing, and resetting speed settings.

## Features

- Adjust playback speed (0.1x to 4.0x).
- Pause and resume animations and timers.
- Reset speed to default (1.0x).
- Keyboard shortcuts for quick control:
  - **Space**: Pause/Resume.
  - **Arrow Up**: Increase speed.
  - **Arrow Down**: Decrease speed.
  - **R**: Reset speed.
- Persistent speed settings.

## Installation

1. Clone or download this repository.
2. Open your browser and navigate to the extensions page:
   - For Chrome: `chrome://extensions/`
   - For Edge: `edge://extensions/`
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the folder containing this project.

## Usage

1. Navigate to a Memrise Speed Review page:
   - `https://community-courses.memrise.com/aprender/speed*`
   - `https://app.memrise.com/*/speed_review*`
2. The speed control UI will appear in the top-right corner of the page.
3. Use the UI buttons or keyboard shortcuts to control playback speed and pause/resume.

## Files

- [`content.js`](content.js): Contains the main logic for overriding timers, creating the UI, and handling user interactions.
- [`manifest.json`](manifest.json): Defines the extension's metadata and permissions.

## Development

### Debugging

- Open the browser's developer tools to view logs and debug messages.
- Modify the `content.js` file to add or remove debug logs as needed.

### Cleanup

To remove the extension's effects, call the following function in the browser console:

```javascript
window.resetMemriseControllerV2();
