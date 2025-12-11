/**
 * @file App.tsx
 * @description The main game controller component.
 * 
 * AI CONTEXT & ARCHITECTURE:
 * - PATTERN: Host-Authoritative Multiplayer.
 *   - The "Host" (creator of the room) runs the `setInterval` game loop.
 *   - The "Host" determines state changes (Timer tick, Hint reveal, Round end).
 *   - The "Clients" are passive observers for game state but active for chatting/guessing.
 * 
 * - STATE MANAGEMENT:
 *   - `isHost` (bool): Determines if this instance runs the logic.
 *   - `socketService`: Handles all network I/O.
 *   - `GameStatus`: Controls the high-level UI View (Lobby vs Board vs GameOver).
 * 
 * - KEY EVENTS:
 *   - `SYNC_STATE`: Full state overwrite sent by Host (on round start/end).
 *   - `SYNC_TIME`: Frequent timer updates (every 1s) from Host.
 *   - `SYNC_HINT_UPDATE`: Sent when Host reveals a new letter or hint.
 *   - `PLAYER_SCORED`: Sent when ANY player guesses correctly.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameStatus, Player, WordData, ChatMessage } from './types';
import { generateWords } from './services/geminiService';
import { socketService } from './services/mockSocket'; // Wraps real WebSocket
import { Lobby } from './components/Lobby';
import { WordDisplay } from './components/WordDisplay';
import { Scoreboard } from './components/Scoreboard';
import { RoundSummary } from './components/RoundSummary';
import { Clock, Send, MessageSquare, AlertCircle, Crown } from 'lucide-react';

const ROUND_TIME = 60;
const HINT_INTERVAL = 15; // Hints revealed every 15 seconds

const App: React.FC = () => {
  // --- Local Game State ---
  const [player, setPlayer] = useState<Player | null>(null);
  const [otherPlayers, setOtherPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [roomId, setRoomId] = useState('');

  // --- Shared Game State (Synced via WebSockets) ---
  const [gameStatus, setGameStatus] = useState<GameStatus>(GameStatus.LOBBY);
  const [currentWord, setCurrentWord] = useState<WordData | null>(null);
  const [wordList, setWordList] = useState<WordData[]>([]); // Only populated for Host
  const [round, setRound] = useState(0);

  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [revealedIndices, setRevealedIndices] = useState<number[]>([]);
  const [revealedHintCount, setRevealedHintCount] = useState(1);
  const [roundWinners, setRoundWinners] = useState<Player[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');

  const [isConnecting, setIsConnecting] = useState(false);

  // --- Refs (For accessing state inside closures/intervals) ---
  const timerRef = useRef<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isHostRef = useRef(isHost); // Keeps track of host status across renders
  const playerRef = useRef<Player | null>(null); // Keeps track of player for listeners

  // --- Initialization & Connection ---

  const handleJoin = async (name: string, roomCode: string) => {
    setIsConnecting(true);

    // 1. Create Local Player
    const newPlayer: Player = {
      id: `p-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name,
      score: 0,
      isSelf: true,
      avatarColor: getRandomColor()
    };
    setPlayer(newPlayer);
    playerRef.current = newPlayer;
    setRoomId(roomCode);

    try {
      // 2. Connect & Join
      await socketService.connect();
      socketService.joinRoom(roomCode, newPlayer);
    } catch (err) {
      console.error("Failed to connect", err);
      alert("Could not connect to game server. Make sure 'node server.js' is running.");
      setIsConnecting(false);
      setPlayer(null);
    }
  };

  const getRandomColor = () => {
    const colors = ['bg-red-500', 'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-orange-500'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  // --- HOST LOGIC: Game Loop ---
  // These functions run ONLY on the client designated as "Host"

  const startGameAsHost = async () => {
    if (!isHost) return;

    // 1. Generate Content (via Gemini or Fallback)
    const words = await generateWords(5);
    setWordList(words);
    setRound(1);

    // 2. Start Game
    startRoundHost(words[0], 1, words);
  };

  const startRoundHost = (word: WordData, roundNum: number, list: WordData[]) => {
    // Update Local Host State
    setCurrentWord(word);
    setTimeLeft(ROUND_TIME);
    setRevealedIndices([]);
    setRevealedHintCount(1);
    setGameStatus(GameStatus.PLAYING);
    setRoundWinners([]); // Reset winners for new round
    addSystemMessage(`Round ${roundNum} started!`);

    // Broadcast Full State to Clients
    socketService.broadcastAction('SYNC_STATE', {
      status: GameStatus.PLAYING,
      currentWord: word,
      timeLeft: ROUND_TIME,
      round: roundNum,
      revealedIndices: [],
      revealedHintCount: 1,
      maxRounds: list.length
    });
  };

  const nextRoundHost = useCallback(() => {
    if (!wordList || wordList.length === 0) return;

    if (round >= wordList.length) {
      // End Game
      setGameStatus(GameStatus.GAME_OVER);
      socketService.broadcastAction('SYNC_STATE', { status: GameStatus.GAME_OVER });
      addSystemMessage("Game Over! Thanks for playing.");
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    const nextRoundNum = round + 1;
    setRound(nextRoundNum);
    startRoundHost(wordList[nextRoundNum - 1], nextRoundNum, wordList);
  }, [round, wordList]);

  // Host Timer Effect
  useEffect(() => {
    // Only Host runs the timer
    if (isHost && gameStatus === GameStatus.PLAYING) {
      timerRef.current = window.setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleTimeOutHost();
            return 0;
          }
          const nextTime = prev - 1;

          // Check if it's time to reveal a hint (every 15s)
          if (nextTime % HINT_INTERVAL === 0 && nextTime !== ROUND_TIME && nextTime > 0) {
            handleGameTickHost(nextTime);
          }

          // Sync timer with clients
          socketService.broadcastAction('SYNC_TIME', { timeLeft: nextTime });
          return nextTime;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isHost, gameStatus, currentWord, revealedIndices, revealedHintCount]);

  const handleGameTickHost = (currentTime: number) => {
    if (!currentWord) return;

    // Logic: Reveal 1 random letter
    const wordLength = currentWord.word.length;
    const indices = Array.from({ length: wordLength }, (_, i) => i);
    const available = indices.filter(i =>
      !revealedIndices.includes(i) && currentWord.word[i] !== ' '
    );

    let newIndices = [...revealedIndices];
    if (available.length > 0) {
      const randomIdx = available[Math.floor(Math.random() * available.length)];
      newIndices.push(randomIdx);
    }

    // Logic: Reveal next hint string
    const newHintCount = Math.min(revealedHintCount + 1, currentWord.hints.length);

    setRevealedIndices(newIndices);
    setRevealedHintCount(newHintCount);

    socketService.broadcastAction('SYNC_HINT_UPDATE', {
      revealedIndices: newIndices,
      revealedHintCount: newHintCount
    });
  };

  const handleTimeOutHost = () => {
    setGameStatus(GameStatus.ROUND_OVER);
    socketService.broadcastAction('SYNC_STATE', { status: GameStatus.ROUND_OVER });
    addSystemMessage(`Time's up! The word was ${currentWord?.word}.`);

    setTimeout(() => {
      nextRoundHost();
    }, 4000);
  };

  // --- CLIENT LOGIC: Interaction ---

  const handleGuess = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !player || !currentWord || gameStatus !== GameStatus.PLAYING) return;

    const text = inputValue.trim();
    const guess = text.toUpperCase();
    const isCorrect = guess === currentWord.word;

    if (isCorrect) {
      // Correct Guess Logic
      const points = calculateScore();
      const newScore = player.score + points;
      const updatedPlayer = { ...player, score: newScore };

      setPlayer(updatedPlayer);
      playerRef.current = updatedPlayer;
      setInputValue('');

      // Create Local Message
      const msg: ChatMessage = {
        id: Date.now().toString(),
        playerId: player.id,
        playerName: player.name,
        text: text,
        type: 'guess_correct',
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, msg]);

      // Broadcast Score Update & Message
      socketService.broadcastAction('PLAYER_SCORED', {
        playerId: player.id,
        score: newScore,
        points,
        playerName: player.name
      });
      socketService.broadcastAction('CHAT', msg);

      // Add self to round winners
      setRoundWinners(prev => {
        if (prev.some(p => p.id === player.id)) return prev;
        return [...prev, { ...player, score: newScore }];
      });

    } else {
      // Normal Chat Logic
      const msg: ChatMessage = {
        id: Date.now().toString(),
        playerId: player.id,
        playerName: player.name,
        text: text,
        type: 'chat',
        timestamp: Date.now()
      };
      setChatMessages(prev => [...prev, msg]);
      socketService.broadcastAction('CHAT', msg);
      setInputValue('');
    }
  };

  const calculateScore = () => {
    return (timeLeft * 15) + 100;
  };

  const addSystemMessage = (text: string) => {
    setChatMessages(prev => [...prev, {
      id: Date.now().toString() + Math.random(),
      playerId: 'system',
      playerName: 'System',
      text,
      type: 'system',
      timestamp: Date.now()
    }]);
  };

  // --- SOCKET LISTENERS ---
  // Handles incoming messages from the server for BOTH Host and Clients

  useEffect(() => {
    // 1. Room/Lobby Events
    const unsubRoom = socketService.on('ROOM_JOINED', (payload: any) => {
      setIsConnecting(false);
      setIsHost(payload.isHost);
      // Filter out self from the list of other players using ref to avoid stale closure
      const others = payload.players.filter((p: Player) => p.id !== playerRef.current?.id);
      setOtherPlayers(others);
      setGameStatus(GameStatus.LOBBY);
      addSystemMessage(payload.isHost ? "You are the Host! Start the game when ready." : "Joined room. Waiting for host...");
    });

    const unsubPlayerJoined = socketService.on('PLAYER_JOINED', (player: Player) => {
      setOtherPlayers(prev => [...prev, player]);
      addSystemMessage(`${player.name} joined the game.`);
    });

    const unsubPlayerLeft = socketService.on('PLAYER_LEFT', (data: any) => {
      setOtherPlayers(prev => prev.filter(p => p.id !== data.id));
    });

    const unsubBecameHost = socketService.on('BECAME_HOST', () => {
      setIsHost(true);
      addSystemMessage("The host left. You are now the Host!");
    });

    // 2. Game Action Events
    const unsubGameAction = socketService.on('GAME_ACTION', (action: any) => {
      const { type, data } = action;

      switch (type) {
        // Full State Sync (Usually on Round Start/End)
        case 'SYNC_STATE':
          if (data.status) setGameStatus(data.status);
          if (data.currentWord) setCurrentWord(data.currentWord);
          if (data.timeLeft !== undefined) setTimeLeft(data.timeLeft);
          if (data.round) setRound(data.round);
          if (data.revealedIndices) setRevealedIndices(data.revealedIndices);
          if (data.revealedHintCount) setRevealedHintCount(data.revealedHintCount);
          if (data.status === GameStatus.PLAYING) {
            setRoundWinners([]); // Reset winners for new round
            addSystemMessage(`Round ${data.round} started!`);
          }
          break;

        // Frequent Timer Sync
        case 'SYNC_TIME':
          setTimeLeft(data.timeLeft);
          break;

        // Hint Reveal Sync
        case 'SYNC_HINT_UPDATE':
          if (data.revealedIndices) setRevealedIndices(data.revealedIndices);
          if (data.revealedHintCount) setRevealedHintCount(data.revealedHintCount);
          break;

        case 'CHAT':
          setChatMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, data];
          });
          break;

        case 'PLAYER_SCORED':
          // Update the scoreboard with the scorer's new score
          setOtherPlayers(prev => prev.map(p =>
            p.id === data.playerId ? { ...p, score: data.score } : p
          ));
          addSystemMessage(`${data.playerName} guessed the word! (+${data.points})`);

          // Add scorer to round winners
          setRoundWinners(prev => {
            if (prev.some(p => p.id === data.playerId)) return prev;
            // We need to construct the player object or find it. 
            // Since we only have partial data, we find in otherPlayers or create a temp one
            const existing = prev.find(p => p.id === data.playerId) || otherPlayers.find(p => p.id === data.playerId);
            if (existing) return [...prev, { ...existing, score: data.score }];

            // Fallback if not found (shouldn't happen often)
            return [...prev, { id: data.playerId, name: data.playerName, score: data.score, isSelf: false, avatarColor: 'bg-gray-500' }];
          });

          setGameStatus(GameStatus.ROUND_OVER);

          // Trigger Host-Side Round Progression
          if (isHostRef.current) {
            setTimeout(() => {
              // Note: Ideally nextRoundHost would be called here.
              // In this effect, we rely on the `useEffect` below observing 'GameStatus.ROUND_OVER'
              // combined with the Host Timer logic or explicit transitions.
            }, 3000);
          }
          break;
      }
    });

    return () => {
      unsubRoom();
      unsubPlayerJoined();
      unsubPlayerLeft();
      unsubBecameHost();
      unsubGameAction();
    };
  }, []);

  // Update ref whenever isHost changes so listeners can access the fresh value
  useEffect(() => {
    isHostRef.current = isHost;
  }, [isHost]);

  // Special Host listener to trigger next round when someone scores
  useEffect(() => {
    if (!isHost) return;

    const unsub = socketService.on('GAME_ACTION', (action: any) => {
      if (action.type === 'PLAYER_SCORED') {
        // If anyone scores, Host ends the round and schedules the next one
        setGameStatus(GameStatus.ROUND_OVER);
        socketService.broadcastAction('SYNC_STATE', { status: GameStatus.ROUND_OVER });
        setTimeout(() => {
          nextRoundHost();
        }, 3000);
      }
    });
    return () => { unsub(); };
  }, [isHost, nextRoundHost]);


  // --- Render (View Layer) ---

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages]);

  if (!player || isConnecting) {
    return <Lobby onJoin={handleJoin} isGenerating={isConnecting} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row overflow-hidden">

      {/* LEFT: Main Game Area */}
      <div className="flex-1 flex flex-col relative">
        {/* Header Bar */}
        <header className="h-16 border-b border-slate-700 bg-slate-900/50 backdrop-blur flex items-center justify-between px-6">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold">WR</div>
              <h1 className="font-bold text-lg hidden sm:block">Word Rush</h1>
            </div>
            <div className="bg-slate-800 text-slate-400 px-3 py-1 rounded-md text-xs font-mono border border-slate-700">
              Room: {roomId}
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2 bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
              <span className="text-slate-400 text-sm">ROUND</span>
              <span className="font-bold text-indigo-400">{round} / 5</span>
            </div>
            <div className={`flex items-center space-x-2 font-mono text-xl font-bold ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-slate-200'}`}>
              <Clock className="w-5 h-5" />
              <span>{timeLeft}s</span>
            </div>
          </div>
        </header>

        {/* Game Canvas */}
        <main className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-y-auto">
          {/* Host Waiting Screen */}
          {isHost && gameStatus === GameStatus.LOBBY && (
            <div className="text-center z-10 p-8 bg-slate-800/50 rounded-2xl border border-slate-700 backdrop-blur-sm">
              <Crown className="w-12 h-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold mb-2">You are the Host</h2>
              <p className="text-slate-400 mb-6">Wait for players to join, then start the game.</p>
              <button
                onClick={startGameAsHost}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-indigo-500/25"
              >
                Start Game
              </button>
            </div>
          )}

          {/* Client Waiting Screen */}
          {!isHost && gameStatus === GameStatus.LOBBY && (
            <div className="text-center z-10 p-8">
              <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <h2 className="text-xl font-bold text-slate-200">Waiting for Host to start...</h2>
            </div>
          )}

          {/* Active Game Board */}
          {gameStatus !== GameStatus.LOBBY && currentWord && (
            <div className="w-full max-w-4xl">
              <WordDisplay
                wordData={currentWord}
                revealedIndices={revealedIndices}
                revealedHintCount={revealedHintCount}
                status={gameStatus}
              />
            </div>
          )}

          {/* Round Over Overlay */}
          {gameStatus === GameStatus.ROUND_OVER && (
            <RoundSummary
              winners={roundWinners}
              word={currentWord?.word || ''}
            />
          )}

          {/* Game Over Overlay */}
          {gameStatus === GameStatus.GAME_OVER && (
            <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-20">
              <div className="bg-gradient-to-br from-indigo-900 to-slate-900 border border-indigo-500 p-10 rounded-2xl shadow-2xl text-center max-w-lg w-full">
                <h2 className="text-4xl font-bold text-white mb-6">Game Over!</h2>
                <div className="space-y-4 mb-8">
                  <div className="flex justify-between items-center bg-white/10 p-4 rounded-lg">
                    <span className="text-slate-300">Your Score</span>
                    <span className="text-3xl font-bold text-yellow-400">{player.score}</span>
                  </div>
                </div>
                {isHost && (
                  <button
                    onClick={() => {
                      setGameStatus(GameStatus.LOBBY);
                      socketService.broadcastAction('SYNC_STATE', { status: GameStatus.LOBBY });
                    }}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-bold transition-all"
                  >
                    Back to Lobby
                  </button>
                )}
              </div>
            </div>
          )}
        </main>

        <div className="h-12 bg-slate-800 border-t border-slate-700 flex items-center justify-center text-xs sm:text-sm text-slate-400">
          <AlertCircle className="w-4 h-4 mr-2 text-indigo-400" />
          <span>Hint revealed every 15 seconds. Guess early for more points!</span>
        </div>
      </div>

      {/* RIGHT: Sidebar (Scoreboard & Chat) */}
      <div className="w-full md:w-80 bg-slate-900 border-l border-slate-700 flex flex-col h-[40vh] md:h-auto">
        <div className="flex-1 p-4 min-h-0 overflow-hidden">
          <Scoreboard players={[player, ...otherPlayers]} />
        </div>

        <div className="h-2/3 md:h-1/2 flex flex-col border-t border-slate-700 bg-slate-800/50">
          <div className="p-3 border-b border-slate-700 bg-slate-800 flex items-center justify-between">
            <div className="flex items-center">
              <MessageSquare className="w-4 h-4 mr-2 text-indigo-400" />
              <span className="text-sm font-bold text-slate-300">Live Chat</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" ref={scrollRef}>
            {chatMessages.map((msg) => {
              if (msg.type === 'system') {
                return (
                  <div key={msg.id} className="text-center my-2">
                    <span className="text-xs bg-slate-700/50 text-slate-400 px-2 py-1 rounded-full">
                      {msg.text}
                    </span>
                  </div>
                );
              }
              const isMe = msg.playerId === player.id;
              const isCorrect = msg.type === 'guess_correct';
              return (
                <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-end space-x-2">
                    {!isMe && <span className="text-xs text-slate-500 mb-1">{msg.playerName}</span>}
                    <div
                      className={`
                          max-w-[85%] px-3 py-2 rounded-lg text-sm
                          ${isCorrect
                          ? 'bg-green-600/20 border border-green-500/50 text-green-200'
                          : isMe
                            ? 'bg-indigo-600 text-white rounded-tr-none'
                            : 'bg-slate-700 text-slate-200 rounded-tl-none'}
                        `}
                    >
                      {isCorrect ? 'Correctly guessed the word!' : msg.text}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleGuess} className="p-3 bg-slate-800 border-t border-slate-700">
            <div className="relative">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={gameStatus === GameStatus.PLAYING ? "Type your guess..." : "Wait for round..."}
                disabled={gameStatus !== GameStatus.PLAYING}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg pl-4 pr-10 py-2.5 text-sm text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || gameStatus !== GameStatus.PLAYING}
                className="absolute right-1.5 top-1.5 p-1 text-indigo-400 hover:text-indigo-300 disabled:text-slate-600 transition-colors"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default App;