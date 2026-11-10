import React from 'react';
import { MatchPlayer, MapData } from '../types/game';
import { AGENTS } from '../data/agents';
import { X, Trophy, DollarSign, Wifi } from 'lucide-react';

interface ScoreboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  allPlayers: MatchPlayer[];
  alphaScore: number;
  omegaScore: number;
  mapData: MapData;
}

export const ScoreboardModal: React.FC<ScoreboardModalProps> = ({
  isOpen,
  onClose,
  allPlayers,
  alphaScore,
  omegaScore,
  mapData
}) => {
  if (!isOpen) return null;

  const alphaTeam = allPlayers.filter(p => p.team === 'alpha');
  const omegaTeam = allPlayers.filter(p => p.team === 'omega');

  const renderTeamTable = (team: MatchPlayer[], teamName: string, isAlpha: boolean) => (
    <div className="flex flex-col flex-1">
      <div className={`p-3 rounded-t-xl flex items-center justify-between border-b ${
        isAlpha 
          ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300' 
          : 'bg-red-950/40 border-red-500/40 text-red-300'
      }`}>
        <div className="flex items-center gap-2">
          <span className="font-black text-sm tracking-wider uppercase">{teamName}</span>
          <span className="text-xs text-slate-400 font-mono-tactical">({team.filter(p => p.isAlive).length} ALIVE)</span>
        </div>
        <span className="text-2xl font-black font-mono-tactical">
          {isAlpha ? alphaScore : omegaScore}
        </span>
      </div>

      <div className="bg-slate-900/60 border-x border-b border-slate-800 rounded-b-xl overflow-hidden">
        <table className="w-full text-left text-xs font-mono-tactical">
          <thead className="bg-slate-950/80 text-slate-400 text-[10px] uppercase">
            <tr>
              <th className="p-2.5">OPERATIVE</th>
              <th className="p-2.5 text-center">K</th>
              <th className="p-2.5 text-center">D</th>
              <th className="p-2.5 text-center">A</th>
              <th className="p-2.5 text-center">SCORE</th>
              <th className="p-2.5 text-right">CREDITS</th>
              <th className="p-2.5 text-center">PING</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {team.map((player) => {
              const agent = AGENTS.find(a => a.id === player.agentId) || AGENTS[0];
              const isLocalPlayer = player.id === 'player';

              return (
                <tr 
                  key={player.id} 
                  className={`hover:bg-slate-800/40 transition-colors ${
                    isLocalPlayer ? 'bg-cyan-500/10 font-bold' : ''
                  }`}
                >
                  <td className="p-2.5 flex items-center gap-2">
                    <div 
                      className="w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black border"
                      style={{ 
                        backgroundColor: agent.themeColor + '33',
                        borderColor: agent.themeColor,
                        color: agent.themeColor
                      }}
                    >
                      {agent.callsign[0]}
                    </div>
                    <div>
                      <span className={`block ${isLocalPlayer ? 'text-cyan-300' : 'text-slate-200'}`}>
                        {player.name}
                      </span>
                      <span className="text-[9px] text-slate-500">{agent.callsign}</span>
                    </div>
                  </td>
                  <td className="p-2.5 text-center font-bold text-slate-200">{player.stats.kills}</td>
                  <td className="p-2.5 text-center text-slate-400">{player.stats.deaths}</td>
                  <td className="p-2.5 text-center text-slate-400">{player.stats.assists}</td>
                  <td className="p-2.5 text-center font-bold text-amber-300">
                    {player.stats.kills * 200 + player.stats.assists * 75}
                  </td>
                  <td className="p-2.5 text-right text-emerald-400 font-bold">${player.credits}</td>
                  <td className="p-2.5 text-center text-slate-500 flex items-center justify-center gap-1">
                    <Wifi className="w-3 h-3 text-emerald-400" /> 18ms
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none font-chakra">
      <div className="w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Trophy className="w-6 h-6 text-amber-400" />
            <div>
              <h3 className="text-lg font-black tracking-wider text-slate-100">MATCH TELEMETRY & SCOREBOARD</h3>
              <p className="text-xs text-slate-400 font-mono-tactical">
                MAP: {mapData.name.toUpperCase()} · 5v5 TACTICAL PLANT · FIRST TO 13 ROUNDS
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Teams Side-by-Side */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-6">
          {renderTeamTable(alphaTeam, 'ALPHA SQUAD (ATTACKERS)', true)}
          {renderTeamTable(omegaTeam, 'OMEGA DEFENDERS (SITE DEFENSE)', false)}
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-900/60 border-t border-slate-800 flex justify-between items-center text-xs text-slate-400 px-6 font-mono-tactical">
          <span>PRESS [TAB] OR TAP CLOSE TO DISMISS</span>
          <span className="text-cyan-400 font-bold">PROTOCOL: APEX AUTHORITATIVE SERVER</span>
        </div>
      </div>
    </div>
  );
};
