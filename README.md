# DrawGame

Real-time multiplayer turn-based drawing game.

## Setup

```bash
# Install all dependencies
npm run install:all

# Development (runs server on :3001 and client on :5173)
npm run dev

# Build for production
npm run build

# Start production server
npm start
```

## How to Play

1. Player 1 creates a game and shares the room link
2. Player 2 joins via the link
3. Player 1 enters a secret character name
4. Player 1 sends hints one at a time
5. Player 2 draws based on the hints
6. Player 1 scores the drawing and leaves a comment
7. Roles switch and repeat!
