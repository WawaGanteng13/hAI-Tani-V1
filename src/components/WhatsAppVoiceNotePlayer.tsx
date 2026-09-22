import React, { useState, useEffect } from 'react';
import { Play, Pause, Mic, Volume2, ChevronDown, ChevronUp } from 'lucide-react';

interface VoiceNoteProps {
  duration?: string;
  transcription?: string;
  isUser: boolean;
  timestamp: string;
}

export const WhatsAppVoiceNotePlayer: React.FC<VoiceNoteProps> = ({
  duration = '0:14',
  transcription,
  isUser,
  timestamp,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [showTranscript, setShowTranscript] = useState(true);

  // Waveform bars heights (pseudo-random amplitude)
  const waveHeights = [
    25, 40, 60, 80, 45, 90, 75, 30, 85, 95, 60, 40, 70, 90, 50, 65, 80, 35, 55, 75, 90, 40, 30, 60,
  ];

  useEffect(() => {
    let interval: any;
    if (isPlaying) {
      interval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setIsPlaying(false);
            return 0;
          }
          return prev + 5;
        });
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isPlaying]);

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="space-y-2 min-w-[240px] sm:min-w-[280px]">
      {/* Audio Player Container */}
      <div className="flex items-center space-x-2.5 pt-1">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-xs transition cursor-pointer active:scale-90 ${
            isUser
              ? 'bg-emerald-700 hover:bg-emerald-800 text-white'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }`}
          title={isPlaying ? 'Jeda' : 'Putar Pesan Suara'}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        {/* Waveform Visualizer & Slider */}
        <div className="flex-1 flex flex-col justify-center space-y-1">
          <div className="flex items-center space-x-0.5 h-7">
            {waveHeights.map((h, i) => {
              const barPercent = (i / waveHeights.length) * 100;
              const isPlayed = barPercent <= progress;
              return (
                <div
                  key={i}
                  className="flex-1 rounded-full transition-all duration-75"
                  style={{
                    height: `${h}%`,
                    backgroundColor: isPlayed
                      ? isUser
                        ? '#047857' // emerald-700
                        : '#059669' // emerald-600
                      : isUser
                      ? '#A7F3D0' // emerald-200
                      : '#CBD5E1', // slate-300
                  }}
                />
              );
            })}
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
            <span>{isPlaying ? `0:0${Math.floor((progress / 100) * 14)}` : duration}</span>
            <span className="flex items-center space-x-1">
              <Mic className="w-3 h-3 text-emerald-600 inline" />
              <span>Voice Note</span>
            </span>
          </div>
        </div>

        {/* Sender Avatar with Mic Badge */}
        <div className="relative shrink-0">
          <div className="w-8 h-8 rounded-full bg-emerald-200 text-emerald-900 font-bold flex items-center justify-center text-xs border border-emerald-300">
            {isUser ? '👤' : '🌾'}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[8px]">
            <Mic className="w-2.5 h-2.5" />
          </div>
        </div>
      </div>

      {/* Transcription Box */}
      {transcription && (
        <div className="bg-black/5 rounded-xl p-2 text-xs border border-black/5">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className="w-full flex items-center justify-between text-[10px] font-semibold text-emerald-800 hover:text-emerald-950 cursor-pointer"
          >
            <span className="flex items-center space-x-1">
              <Volume2 className="w-3 h-3" />
              <span>Transkripsi Suara (Speech-to-Text AI)</span>
            </span>
            {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showTranscript && (
            <p className="mt-1 text-slate-800 text-xs italic leading-relaxed border-t border-black/5 pt-1">
              "{transcription}"
            </p>
          )}
        </div>
      )}
    </div>
  );
};
