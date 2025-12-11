/**
 * @file types.ts
 * @description Defines the core data models for the Word Rush game.
 * 
 * AI CONTEXT:
 * - This file serves as the "Source of Truth" for data shapes.
 * - `WordData` structure was recently changed from a single category string to a `hints` string array.
 * - `GameStatus` acts as a finite state machine for the UI.
 */

export interface Player {
  id: string;       // Unique ID (e.g., "p-1700000000")
  name: string;     // Display name
  score: number;    // Current game score
  isSelf: boolean;  // Client-side flag to identify the local user
  avatarColor: string; // Tailwind class for avatar background
}

export interface WordData {
  word: string;     // The target word (UPPERCASE)
  hints: string[];  // List of 3 progressive hints (Vague -> Specific)
  difficulty: 'easy' | 'medium' | 'hard';
}

export enum GameStatus {
  LOBBY = 'LOBBY',          // Waiting room
  PLAYING = 'PLAYING',      // Active round
  ROUND_OVER = 'ROUND_OVER',// Round ended (show word)
  GAME_OVER = 'GAME_OVER'   // Game finished (show winner)
}

export interface GameState {
  status: GameStatus;
  currentWord: WordData | null;
  revealedIndices: number[]; // Indices of letters revealed in the current word
  revealedHintCount: number; // Number of hints currently visible
  timeLeft: number;          // Seconds remaining in round
  round: number;             // Current round number (1-indexed)
  maxRounds: number;         // Total rounds (usually 5)
  chatMessages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  type: 'chat' | 'system' | 'guess_correct' | 'guess_wrong';
  timestamp: number;
}