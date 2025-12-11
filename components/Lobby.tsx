/**
 * @file Lobby.tsx
 * @description Entry screen where users enter nickname and room code.
 */
import React, { useState } from 'react';
import { Play, Users, Zap, Hash } from 'lucide-react';

interface LobbyProps {
  onJoin: (name: string, roomId: string) => void;
  isGenerating: boolean;
}

export const Lobby: React.FC<LobbyProps> = ({ onJoin, isGenerating }) => {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('LOBBY-1');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && roomId.trim()) {
      onJoin(name.trim(), roomId.trim());
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 p-4">
      <div className="max-w-md w-full bg-slate-800/80 backdrop-blur-lg rounded-2xl border border-slate-700 p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500 mb-4 shadow-[0_0_20px_rgba(99,102,241,0.5)]">
            <Zap className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Word Rush</h1>
          <p className="text-slate-400">Multiplayer Word Guessing</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div>
              <label htmlFor="nickname" className="block text-sm font-medium text-slate-300 mb-2">
                Nickname
              </label>
              <input
                type="text"
                id="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. WordMaster99"
                className="w-full px-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                required
                maxLength={12}
              />
            </div>

            <div>
              <label htmlFor="room" className="block text-sm font-medium text-slate-300 mb-2">
                Room Code
              </label>
              <div className="relative">
                <Hash className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                <input
                  type="text"
                  id="room"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="e.g. LOBBY-1"
                  className="w-full pl-10 pr-4 py-3 bg-slate-900 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || !roomId.trim() || isGenerating}
            className={`
              w-full flex items-center justify-center space-x-2 py-4 rounded-xl font-bold text-lg transition-all
              ${name.trim() && roomId.trim() && !isGenerating
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_4px_14px_0_rgba(99,102,241,0.39)] hover:-translate-y-0.5' 
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
            `}
          >
            {isGenerating ? (
              <span>Connecting...</span>
            ) : (
              <>
                <Play className="w-5 h-5" />
                <span>Join Game</span>
              </>
            )}
          </button>
        </form>
        
        <div className="mt-4 text-center">
            <p className="text-xs text-slate-500">Ensure local server is running on port 8080</p>
        </div>
      </div>
    </div>
  );
};