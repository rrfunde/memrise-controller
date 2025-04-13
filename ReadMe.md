# Memrise Speed & Pause Control

Memrise Speed & Pause Control is a tool that allows you to control playback speed and pause/resume during Memrise Speed Reviews. It provides an intuitive UI for adjusting speed, pausing, and resetting speed settings.

## Features

- Adjust playback speed (0.1x to 4.0x).
- Pause and resume animations and timers.
- Reset speed to default (1.0x).
- Keyboard shortcuts for quick control:
  - **Space**: Pause/Resume.
  - **R**: Reset speed.
- Persistent speed settings.

## Installation Options

### Browser Extension (Chrome/Edge)

1. Clone or download this repository.
2. Open your browser and navigate to the extensions page:
   - For Chrome: `chrome://extensions/`
   - For Edge: `edge://extensions/`
3. Enable **Developer mode**.
4. Click **Load unpacked** and select the folder containing this project.

### Safari iOS/iPadOS (UserScripts)

1. Install the [UserScripts](https://apps.apple.com/us/app/userscripts/id1463298887) app from the App Store.
2. Open the UserScripts app and follow the setup instructions.
3. In Safari, go to Settings > Extensions > UserScripts and enable it.
4. Enable "Allow All Websites" for UserScripts in Safari settings.
5. Create a new script in the UserScripts app:
   - Tap the "+" button to add a new script
   - Name it "Memrise Speed Controller"
   - Copy and paste the contents of [`userscripts/memrise.js`](userscripts/memrise.js) into the script editor
   - Set the script to run on `*.memrise.com`
   - Save the script
6. Visit Memrise in Safari, and the UserScripts icon should appear in the address bar.
7. Tap the UserScripts icon and enable the Memrise Speed Controller script.

## Usage

1. Navigate to a Memrise page.
2. The speed control UI will appear in the top-right corner of the page.
3. Use the UI buttons or keyboard shortcuts to control playback speed and pause/resume.

## Files

- [`content.js`](content.js): Contains the main logic for the browser extension version.
- [`manifest.json`](manifest.json): Defines the extension's metadata and permissions.
- [`userscripts/memrise.js`](userscripts/memrise.js): Standalone userscript for Safari iOS/iPadOS.

## Development

### Debugging

- Open the browser's developer tools to view logs and debug messages.
- Modify the script files to add or remove debug logs as needed.

### Cleanup

To remove the extension's effects, call the following function in the browser console:

```javascript
window.resetMemriseControllerV2();
