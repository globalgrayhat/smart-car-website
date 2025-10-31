# Arduino Car Control and Camera Streaming

A complete dashboard to control an Arduino-based car and stream live camera feed using WebRTC from an Android phone.

## Features

- Live camera feed from Android phone using WebRTC
- Zoom In/Out buttons for camera control
- Directional controls (left, right, forward, backward) for the car
- Display car status (Online/Offline) and battery percentage
- Option to share mobile screen in the dashboard
- Support for both Dark Mode and Light Mode
- Smooth animations and interactive effects using GSAP
- Responsive design for mobile and desktop

## Requirements

- Node.js version 22.21.1

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Start the WebRTC signaling server:
   ```bash
   npm run start:server
   ```

4. Access the application:
   - Frontend: http://localhost:5173
   - Signaling server: http://localhost:5000

## Technologies Used

- React
- Vite
- TypeScript
- TailwindCSS
- GSAP
- WebRTC
- Material UI
- Express (for Server)
- Socket.io (for WebRTC signaling)

## Project Structure

- `/src/components` - React components
  - `CameraStream.tsx` - WebRTC camera streaming component
  - `CarControls.tsx` - Directional control buttons
  - `ThemeToggle.tsx` - Dark/Light mode toggle
- `/server.ts` - WebRTC signaling server

## VPS Setup (for production)

1. Install Node.js on the VPS
2. Install Express.js and Socket.io for WebRTC signaling
3. Set up HTTPS if required for WebRTC connections
4. Start the Express server to handle WebRTC signaling (port 5000)
5. Allow incoming traffic to the signaling port (5000)
