# 🏇 Horse Race Game

A multiplayer horse racing game where players scan a QR code to join and use their phones as controllers to race horses on the main display.

## Features

- QR code scanning to join game
- Unlimited players with auto-scaling UI
- Real-time racing with tap controls
- Modern, clean design
- Mobile-optimized controller interface
- WebSocket-based real-time communication

## Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open the main display at `http://localhost:3000`
4. Players scan the QR code to join on their phones
5. Click "Start Race" to begin
6. Players tap rapidly on their phones to move their horses

## Deployment

### Environment Variables

Set these for production deployment:
- `PORT` - Server port (default: 3000)
- `HOST` - Server hostname for QR code generation

### AWS Deployment Options

1. **AWS Elastic Beanstalk** (Easiest)
   - Create new application
   - Upload zip of project
   - EB handles everything automatically

2. **AWS EC2**
   - Launch Ubuntu instance
   - Install Node.js
   - Clone repo and run `npm install && npm start`
   - Use PM2 for process management

3. **AWS App Runner**
   - Connect GitHub repo
   - Auto-deploys on push

### Alternative Platforms (Simpler)

- **Railway.app** - Connect GitHub, auto-deploy
- **Render.com** - Free tier available
- **Fly.io** - Global edge deployment

## How to Play

1. Display main screen on TV/projector
2. Players scan QR code with phones
3. Enter name and wait for race to start
4. Tap as fast as possible to move your horse
5. First to finish line wins!

## Tech Stack

- Node.js + Express
- Socket.io for real-time communication
- Vanilla JavaScript (no framework overhead)
- QR code generation
- Responsive CSS design
