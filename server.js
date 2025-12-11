/**
 * @file server.js
 * @description A lightweight Node.js WebSocket relay server.
 * 
 * AI CONTEXT:
 * - ARCHITECTURE: "Dumb Relay". The server stores minimal state (just room membership).
 * - LOGIC: It does NOT run the game loop. The "Host" client runs the loop and sends updates.
 * - PROTOCOL: JSON messages with `{ type, payload }`.
 * - LIFECYCLE: Rooms are created on demand and destroyed when empty.
 */

import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 8080;

// Serve static files from the dist directory
app.use(express.static(path.join(__dirname, 'dist')));

// State: Map<RoomID, RoomObject>
// RoomObject: { players: Array, hostId: string }
const rooms = new Map();

wss.on('connection', (ws) => {
  let currentRoomId = null;
  let currentPlayerId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      const { type, payload } = data;

      // --- JOIN LOGIC ---
      if (type === 'JOIN_ROOM') {
        const { roomId, player } = payload;
        currentRoomId = roomId;
        currentPlayerId = player.id;

        // Create room if it doesn't exist
        if (!rooms.has(roomId)) {
          rooms.set(roomId, { players: [], hostId: player.id });
          console.log(`Room ${roomId} created by ${player.name}`);
        }

        const room = rooms.get(roomId);

        // Handle Reconnects vs New Joins
        const existingPlayerIndex = room.players.findIndex(p => p.id === player.id);
        if (existingPlayerIndex !== -1) {
          room.players[existingPlayerIndex].ws = ws; // Update connection reference
          room.players[existingPlayerIndex].name = player.name;
        } else {
          // Store player with WS connection (stripped when sending to clients)
          room.players.push({ ...player, ws });
        }

        const isHost = room.hostId === player.id;

        // 1. Acknowledge Join to Client
        ws.send(JSON.stringify({
          type: 'ROOM_JOINED',
          payload: {
            isHost,
            // Sanitize: Don't send the 'ws' object over the wire
            players: room.players.map(p => ({ ...p, ws: undefined }))
          }
        }));

        // 2. Broadcast presence to Room
        broadcastToRoom(roomId, 'PLAYER_JOINED', player, player.id);
      }

      // --- GAME RELAY ---
      // The server does not inspect payload content, just forwards it.
      else if (type === 'GAME_ACTION') {
        broadcastToRoom(currentRoomId, 'GAME_ACTION', payload, currentPlayerId);
      }

    } catch (e) {
      console.error("Error processing message:", e);
    }
  });

  // --- DISCONNECT LOGIC ---
  ws.on('close', () => {
    if (currentRoomId && rooms.has(currentRoomId)) {
      const room = rooms.get(currentRoomId);

      // Remove player from list
      if (room) {
        room.players = room.players.filter(p => p.id !== currentPlayerId);

        broadcastToRoom(currentRoomId, 'PLAYER_LEFT', { id: currentPlayerId });

        if (room.players.length === 0) {
          // Cleanup empty room
          rooms.delete(currentRoomId);
          console.log(`Room ${currentRoomId} deleted`);
        } else if (room.hostId === currentPlayerId) {
          // Host Migration: If Host leaves, assign the first available player as new Host
          const newHost = room.players[0];
          room.hostId = newHost.id;
          console.log(`New host for room ${currentRoomId} is ${newHost.name}`);

          if (newHost.ws && newHost.ws.readyState === 1) {
            newHost.ws.send(JSON.stringify({
              type: 'BECAME_HOST',
              payload: {}
            }));
          }
        }
      }
    }
  });
});

/**
 * Helper to send a message to everyone in a room except the sender.
 */
function broadcastToRoom(roomId, type, payload, excludeId = null) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.players.forEach(p => {
    if (p.id !== excludeId && p.ws && p.ws.readyState === 1) {
      p.ws.send(JSON.stringify({ type, payload }));
    }
  });
}

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
