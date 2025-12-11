/**
 * @file Scoreboard.tsx
 * @description Displays the list of players sorted by score.
 */
import React from 'react';
import { Player } from '../types';
import { Trophy, User } from 'lucide-react';

interface ScoreboardProps {
  players: Player[];
}

export const Scoreboard: React.FC<ScoreboardProps> = ({ players }) => {
  const sortedPlayers = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="bg-slate-800/80 backdrop-blur-md border border-slate-700 rounded-xl p-4 h-full flex flex-col">
      <div className="flex items-center space-x-2 mb-4 pb-2 border-b border-slate-700">
        <Trophy className="w-5 h-5 text-yellow-400" />
        <h3 className="font-bold text-slate-200">Leaderboard</h3>
      </div>
      
      <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
        {sortedPlayers.map((player, index) => (
          <div 
            key={player.id}
            className={`
              flex items-center justify-between p-3 rounded-lg transition-all
              ${player.isSelf ? 'bg-indigo-900/30 border border-indigo-500/30' : 'bg-slate-700/30 border border-transparent'}
            `}
          >
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className={`w-8 h-8 rounded-full ${player.avatarColor} flex items-center justify-center text-white font-bold text-xs`}>
                  {player.name.substring(0, 2).toUpperCase()}
                </div>
                {index === 0 && (
                  <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-0.5 border border-slate-900">
                     <Trophy className="w-2 h-2 text-slate-900" />
                  </div>
                )}
              </div>
              <div>
                <p className={`text-sm font-medium ${player.isSelf ? 'text-indigo-300' : 'text-slate-300'}`}>
                  {player.name} {player.isSelf && '(You)'}
                </p>
              </div>
            </div>
            <div className="font-mono font-bold text-slate-200">
              {player.score}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};