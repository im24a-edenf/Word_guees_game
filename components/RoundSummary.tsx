import React, { useEffect, useState } from 'react';
import { Trophy, Medal, Star } from 'lucide-react';
import { Player } from '../types';

interface RoundSummaryProps {
    winners: Player[];
    word: string;
    onClose?: () => void;
}

export const RoundSummary: React.FC<RoundSummaryProps> = ({ winners, word, onClose }) => {
    const [show, setShow] = useState(false);

    useEffect(() => {
        setShow(true);
        // Auto-close logic can be handled by parent or here if needed
    }, []);

    // Sort winners by score (descending) - though usually we just pass the ones who guessed right
    // For this popup, we might want to show just the people who got it right this round?
    // Or the top 3 overall? The request said "who performed the best in that round".
    // So we should probably pass the list of players who guessed correctly this round.

    return (
        <div className={`absolute inset-0 bg-slate-900/90 backdrop-blur-md flex items-center justify-center z-50 transition-opacity duration-500 ${show ? 'opacity-100' : 'opacity-0'}`}>
            <div className="bg-gradient-to-b from-indigo-900 to-slate-900 border border-indigo-500/50 p-8 rounded-2xl shadow-2xl text-center max-w-2xl w-full mx-4 transform transition-all duration-500 scale-100">

                <div className="mb-8">
                    <h2 className="text-4xl font-bold text-white mb-2 tracking-tight">Round Complete!</h2>
                    <p className="text-slate-400 text-lg">The word was <span className="text-indigo-400 font-bold uppercase tracking-wider">{word}</span></p>
                </div>

                {winners.length > 0 ? (
                    <div className="space-y-4 mb-8">
                        <h3 className="text-xl font-semibold text-indigo-200 mb-4">Top Performers</h3>
                        <div className="grid gap-4">
                            {winners.map((player, index) => (
                                <div
                                    key={player.id}
                                    className="flex items-center justify-between bg-white/5 border border-white/10 p-4 rounded-xl animate-slide-in"
                                    style={{ animationDelay: `${index * 150}ms` }}
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
                      ${index === 0 ? 'bg-yellow-500 text-yellow-900' :
                                                index === 1 ? 'bg-slate-300 text-slate-900' :
                                                    index === 2 ? 'bg-amber-700 text-amber-100' : 'bg-slate-700 text-slate-300'}
                    `}>
                                            {index === 0 ? <Trophy className="w-5 h-5" /> :
                                                index === 1 ? <Medal className="w-5 h-5" /> :
                                                    index === 2 ? <Medal className="w-5 h-5" /> :
                                                        <span>{index + 1}</span>}
                                        </div>
                                        <div className="text-left">
                                            <div className="font-bold text-white">{player.name}</div>
                                            <div className="text-xs text-slate-400">Guessed correctly</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                                        <span className="font-bold text-yellow-400 text-xl">{player.score}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="py-8 text-slate-500 italic">
                        No one guessed the word this round. Better luck next time!
                    </div>
                )}

                {onClose && (
                    <button onClick={onClose} className="mt-6 text-slate-400 hover:text-white text-sm underline">
                        Close
                    </button>
                )}
            </div>
        </div>
    );
};
