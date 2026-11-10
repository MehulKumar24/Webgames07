import React, { useState } from 'react';
import { ControlSettings, GraphicsSettings, AudioSettings } from '../types/game';
import { X, Sliders, Monitor, Volume2, Gamepad2, RotateCcw } from 'lucide-react';
import { soundEngine } from '../audio/soundEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  controls: ControlSettings;
  graphics: GraphicsSettings;
  audio: AudioSettings;
  onUpdateControls: (newControls: ControlSettings) => void;
  onUpdateGraphics: (newGraphics: GraphicsSettings) => void;
  onUpdateAudio: (newAudio: AudioSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  controls,
  graphics,
  audio,
  onUpdateControls,
  onUpdateGraphics,
  onUpdateAudio
}) => {
  const [tab, setTab] = useState<'controls' | 'graphics' | 'audio'>('controls');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 select-none font-chakra">
      <div className="w-full max-w-3xl bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-black tracking-wider text-slate-100 uppercase">
              TACTICAL SETTINGS & HARDWARE CONFIG
            </h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-red-500/20 text-slate-400 hover:text-red-400 flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-900/40 border-b border-slate-800 p-2 gap-2">
          <button
            onClick={() => setTab('controls')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'controls' ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Gamepad2 className="w-4 h-4" /> CONTROLS (ANDROID & DESKTOP)
          </button>
          <button
            onClick={() => setTab('graphics')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'graphics' ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" /> GRAPHICS & FPS PRESETS
          </button>
          <button
            onClick={() => setTab('audio')}
            className={`flex-1 py-2 rounded-lg text-xs font-bold tracking-wider uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${
              tab === 'audio' ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Volume2 className="w-4 h-4" /> AUDIO & SYNTHESIS
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {tab === 'controls' && (
            <div className="space-y-5">
              {/* Look Sensitivity X */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>LOOK SENSITIVITY (HORIZONTAL)</span>
                  <span className="font-mono-tactical text-cyan-300 font-bold">{controls.lookSensitivityX.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4.0"
                  step="0.1"
                  value={controls.lookSensitivityX}
                  onChange={(e) => onUpdateControls({ ...controls, lookSensitivityX: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Look Sensitivity Y */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>LOOK SENSITIVITY (VERTICAL)</span>
                  <span className="font-mono-tactical text-cyan-300 font-bold">{controls.lookSensitivityY.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="4.0"
                  step="0.1"
                  value={controls.lookSensitivityY}
                  onChange={(e) => onUpdateControls({ ...controls, lookSensitivityY: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* ADS Sensitivity Multiplier */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>ADS ZOOM SENSITIVITY MULTIPLIER</span>
                  <span className="font-mono-tactical text-cyan-300 font-bold">{controls.adsSensitivityMultiplier.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.2"
                  step="0.05"
                  value={controls.adsSensitivityMultiplier}
                  onChange={(e) => onUpdateControls({ ...controls, adsSensitivityMultiplier: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Touch Button Scale */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>TOUCH HUD BUTTON SCALE</span>
                  <span className="font-mono-tactical text-cyan-300 font-bold">{controls.buttonScale.toFixed(2)}x</span>
                </div>
                <input
                  type="range"
                  min="0.8"
                  max="1.4"
                  step="0.05"
                  value={controls.buttonScale}
                  onChange={(e) => onUpdateControls({ ...controls, buttonScale: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Touch Button Opacity */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>TOUCH HUD BUTTON OPACITY</span>
                  <span className="font-mono-tactical text-cyan-300 font-bold">{(controls.buttonOpacity * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0.3"
                  max="1.0"
                  step="0.05"
                  value={controls.buttonOpacity}
                  onChange={(e) => onUpdateControls({ ...controls, buttonOpacity: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-300">INVERT Y-AXIS LOOK</span>
                  <input
                    type="checkbox"
                    checked={controls.invertY}
                    onChange={(e) => onUpdateControls({ ...controls, invertY: e.target.checked })}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-300">GYROSCOPE AIMING</span>
                  <input
                    type="checkbox"
                    checked={controls.gyroscopeEnabled}
                    onChange={(e) => onUpdateControls({ ...controls, gyroscopeEnabled: e.target.checked })}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-300">LEFT-HANDED MOBILE HUD (MIRROR)</span>
                  <input
                    type="checkbox"
                    checked={controls.leftHandedMode}
                    onChange={(e) => onUpdateControls({ ...controls, leftHandedMode: e.target.checked })}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                  <span className="text-xs font-bold text-slate-300">AUTO-RELOAD ON EMPTY MAG</span>
                  <input
                    type="checkbox"
                    checked={controls.autoReload}
                    onChange={(e) => onUpdateControls({ ...controls, autoReload: e.target.checked })}
                    className="w-4 h-4 accent-cyan-400"
                  />
                </label>
              </div>
            </div>
          )}

          {tab === 'graphics' && (
            <div className="space-y-6">
              {/* Presets */}
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3 font-mono-tactical">
                  GRAPHICS PRESETS (OPTIMIZED FOR ANDROID 60FPS)
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {(['Low', 'Medium', 'High', 'Ultra'] as const).map((preset) => (
                    <button
                      key={preset}
                      onClick={() => onUpdateGraphics({
                        ...graphics,
                        preset,
                        shadows: preset !== 'Low'
                      })}
                      className={`py-3 rounded-xl border text-xs font-bold uppercase transition-all cursor-pointer ${
                        graphics.preset === preset
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(0,240,255,0.3)]'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Field of View */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>CAMERA FIELD OF VIEW (FOV)</span>
                  <span className="font-mono-tactical text-cyan-300 font-bold">{graphics.fov}°</span>
                </div>
                <input
                  type="range"
                  min="75"
                  max="105"
                  step="1"
                  value={graphics.fov}
                  onChange={(e) => onUpdateGraphics({ ...graphics, fov: parseInt(e.target.value) })}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Dynamic Shadows */}
              <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">DYNAMIC SHADOW MAPS</span>
                  <span className="text-[10px] text-slate-400">High-fidelity PCF soft contact shadows</span>
                </div>
                <input
                  type="checkbox"
                  checked={graphics.shadows}
                  onChange={(e) => onUpdateGraphics({ ...graphics, shadows: e.target.checked })}
                  className="w-4 h-4 accent-cyan-400"
                />
              </label>
            </div>
          )}

          {tab === 'audio' && (
            <div className="space-y-5">
              {/* Master Volume */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>MASTER AUDIO VOLUME</span>
                  <span className="font-mono-tactical text-cyan-300 font-bold">{(audio.masterVolume * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audio.masterVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const newAudio = { ...audio, masterVolume: val };
                    onUpdateAudio(newAudio);
                    soundEngine.setVolumes(val, audio.sfxVolume, audio.musicVolume, audio.muted);
                  }}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* SFX Volume */}
              <div>
                <div className="flex justify-between text-xs text-slate-300 mb-2">
                  <span>SOUND EFFECTS (WEAPONS & ABILITIES)</span>
                  <span className="font-mono-tactical text-cyan-300 font-bold">{(audio.sfxVolume * 100).toFixed(0)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={audio.sfxVolume}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    const newAudio = { ...audio, sfxVolume: val };
                    onUpdateAudio(newAudio);
                    soundEngine.setVolumes(audio.masterVolume, val, audio.musicVolume, audio.muted);
                  }}
                  className="w-full accent-cyan-400"
                />
              </div>

              {/* Mute Toggle */}
              <label className="flex items-center justify-between p-3.5 rounded-xl bg-slate-900 border border-slate-800 cursor-pointer">
                <span className="text-xs font-bold text-slate-200">MUTE ALL AUDIO</span>
                <input
                  type="checkbox"
                  checked={audio.muted}
                  onChange={(e) => {
                    const muted = e.target.checked;
                    const newAudio = { ...audio, muted };
                    onUpdateAudio(newAudio);
                    soundEngine.setVolumes(audio.masterVolume, audio.sfxVolume, audio.musicVolume, muted);
                  }}
                  className="w-4 h-4 accent-cyan-400"
                />
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-900/90 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-wider shadow-[0_0_15px_rgba(0,240,255,0.4)] cursor-pointer transition-all"
          >
            SAVE CONFIGURATION
          </button>
        </div>
      </div>
    </div>
  );
};
