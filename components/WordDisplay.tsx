/**
 * @file WordDisplay.tsx
 * @description Renders the game board, including the hidden word slots and the progressive hints.
 */
import React from 'react';
import { WordData } from '../types';
import { Lightbulb } from 'lucide-react';

interface WordDisplayProps {
  wordData: WordData;
  revealedIndices: number[]; // Array of indices (e.g. [0, 2]) that should be shown
  revealedHintCount: number; // Integer (1 to 3)
  status: string;
}

export const WordDisplay: React.FC<WordDisplayProps> = ({ wordData, revealedIndices, revealedHintCount, status }) => {
  const letters = wordData.word.split('');
  const isGameOver = status === 'ROUND_OVER' || status === 'GAME_OVER';

  return (
    <div className="flex flex-col items-center justify-center space-y-8 my-4">
      
      {/* Word Slots */}
      <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
        {letters.map((letter, index) => {
          const isRevealed = revealedIndices.includes(index) || isGameOver;
          const isSpace = letter === ' ';

          if (isSpace) return <div key={index} className="w-4 sm:w-8" />;

          return (
            <div
              key={index}
              className={`
                flex items-center justify-center 
                w-10 h-14 sm:w-14 sm:h-20 
                text-2xl sm:text-4xl font-bold rounded-lg shadow-lg transition-all duration-300
                ${isRevealed 
                  ? 'bg-slate-100 text-slate-900 translate-y-0 border-b-4 border-slate-300' 
                  : 'bg-slate-800 text-slate-400 translate-y-1 border-2 border-dashed border-slate-600'}
              `}
            >
              {isRevealed ? letter : '_'}
            </div>
          );
        })}
      </div>
      
      {/* Hints Section */}
      <div className="w-full max-w-2xl bg-slate-800/50 rounded-xl p-6 border border-slate-700/50 backdrop-blur-sm">
        <div className="flex items-center mb-4 space-x-2 text-yellow-400">
           <Lightbulb className="w-5 h-5 fill-yellow-400/20" />
           <span className="font-bold tracking-wider text-sm uppercase">Hints</span>
        </div>
        
        <div className="space-y-3">
          {wordData.hints.map((hint, index) => {
            const isVisible = index < revealedHintCount || isGameOver;
            return (
              <div 
                key={index}
                className={`
                  transition-all duration-500 flex items-start space-x-3
                  ${isVisible ? 'opacity-100 translate-x-0' : 'opacity-20 translate-x-4 blur-[2px]'}
                `}
              >
                <div className={`
                  mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0
                  ${isVisible ? 'bg-indigo-400' : 'bg-slate-600'}
                `}></div>
                <p className={`
                  text-lg font-medium leading-relaxed
                  ${isVisible ? 'text-slate-100' : 'text-slate-600 select-none'}
                `}>
                  {isVisible ? hint : "Locked hint..."}
                </p>
              </div>
            );
          })}
        </div>
        
        <div className="mt-4 pt-4 border-t border-slate-700/30 flex justify-between text-xs text-slate-500 font-mono">
           <span>{wordData.word.length} LETTERS</span>
           <span>DIFFICULTY: {wordData.difficulty.toUpperCase()}</span>
        </div>
      </div>
    </div>
  );
};