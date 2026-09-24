import React, { useState, useEffect } from 'react';
import {
  X,
  Cpu,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Zap,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
  Server,
  Activity,
  Check,
  ExternalLink,
} from 'lucide-react';
import { NineRouterStatus } from '../types';

interface NineRouterModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: NineRouterStatus | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export const NineRouterModal: React.FC<NineRouterModalProps> = ({
  isOpen,
  onClose,
  status,
  onRefresh,
  isLoading,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-800/80 border-b border-slate-700/80 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Cpu className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Status Integrasi 9Router Gateway
                </h3>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  AI Gateway
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-Provider AI Gateway & Auto-Fallback untuk WhatsApp TaniAI
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm">
          {/* Status Card Banner */}
          <div
            className={`p-4 rounded-xl border flex items-start space-x-3.5 ${
              status?.healthy
                ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-200'
                : status?.configured
                ? 'bg-amber-950/40 border-amber-700/50 text-amber-200'
                : 'bg-slate-800/60 border-slate-700 text-slate-300'
            }`}
          >
            {status?.healthy ? (
              <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
            ) : status?.configured ? (
              <AlertCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
            ) : (
              <Server className="w-6 h-6 text-slate-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-sm">
                  {status?.healthy
                    ? '9Router AI Gateway Terhubung & Aktif'
                    : status?.configured
                    ? '9Router Dikonfigurasi (Menunggu Respon Gateway)'
                    : '9Router Belum Dikonfigurasi (Fallback Mode Aktif)'}
                </h4>
                {status?.latencyMs !== undefined && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-black/30 text-emerald-300">
                    {status.latencyMs} ms
                  </span>
                )}
              </div>
              <p className="text-xs mt-1 opacity-90">
                {status?.message ||
                  (status?.healthy
                    ? 'Gateway siap melayani inferensi multi-model dengan auto-routing cerdas.'
                    : 'Sistem menggunakan fallback Google Gemini API dan aturan agronomi cerdas.')}
              </p>
            </div>
          </div>

          {/* Fallback Priority Chain Diagram */}
          <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/60 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-400" />
                <span>Urutan Hirarki Eksekusi AI (Failover Chain)</span>
              </span>
              <button
                onClick={onRefresh}
                disabled={isLoading}
                className="flex items-center space-x-1 text-xs text-indigo-300 hover:text-indigo-200 cursor-pointer transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Cek Ulang Gateway</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              {/* Node 1: 9Router */}
              <div
                className={`p-3 rounded-lg border flex flex-col justify-between ${
                  status?.activeProvider === '9router'
                    ? 'bg-indigo-950/60 border-indigo-500 text-indigo-100 shadow-md shadow-indigo-900/30 ring-1 ring-indigo-400'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-300">1. Prioritas Utama</span>
                  {status?.activeProvider === '9router' && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-500 text-white font-bold animate-pulse">
                      AKTIF
                    </span>
                  )}
                </div>
                <div className="font-semibold text-sm flex items-center space-x-1.5">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span>9Router Gateway</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1 truncate">
                  Model: {status?.model || 'openai/gpt-4o'}
                </div>
              </div>

              {/* Node 2: Gemini */}
              <div
                className={`p-3 rounded-lg border flex flex-col justify-between ${
                  status?.activeProvider === 'gemini'
                    ? 'bg-blue-950/60 border-blue-500 text-blue-100 shadow-md shadow-blue-900/30 ring-1 ring-blue-400'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-300">2. Fallback Sekunder</span>
                  {status?.activeProvider === 'gemini' && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500 text-white font-bold animate-pulse">
                      AKTIF
                    </span>
                  )}
                </div>
                <div className="font-semibold text-sm flex items-center space-x-1.5">
                  <Sparkles className="w-4 h-4 text-blue-400" />
                  <span>Google Gemini API</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  gemini-3.1-flash-lite / 3.8
                </div>
              </div>

              {/* Node 3: Rule-based */}
              <div
                className={`p-3 rounded-lg border flex flex-col justify-between ${
                  status?.activeProvider === 'rule_based'
                    ? 'bg-emerald-950/60 border-emerald-500 text-emerald-100 shadow-md shadow-emerald-900/30 ring-1 ring-emerald-400'
                    : 'bg-slate-800/40 border-slate-700 text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-slate-300">3. Fallback Tersier</span>
                  {status?.activeProvider === 'rule_based' && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-600 text-white font-bold animate-pulse">
                      AKTIF
                    </span>
                  )}
                </div>
                <div className="font-semibold text-sm flex items-center space-x-1.5">
                  <Shield className="w-4 h-4 text-emerald-400" />
                  <span>Aturan Agronomi Lokal</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  100% Offline Resilience
                </div>
              </div>
            </div>
          </div>

          {/* Configuration Parameters Table */}
          <div className="border border-slate-700/80 rounded-xl overflow-hidden">
            <div className="bg-slate-800/80 px-4 py-2.5 text-xs font-semibold text-slate-300 border-b border-slate-700/80 flex items-center space-x-2">
              <Activity className="w-3.5 h-3.5 text-purple-400" />
              <span>Detail Konfigurasi Environment</span>
            </div>
            <div className="divide-y divide-slate-800 text-xs bg-slate-900/70">
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-400 font-mono">NINEROUTER_URL</span>
                <span className="font-mono text-slate-200">
                  {status?.url || (
                    <span className="text-slate-500 italic">Belum dikonfigurasi (.env)</span>
                  )}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-400 font-mono">NINEROUTER_KEY</span>
                <span className="text-slate-200">
                  {status?.hasKey ? (
                    <span className="text-emerald-400 flex items-center space-x-1">
                      <Check className="w-3.5 h-3.5" />
                      <span>Tersedia & Terenkripsi</span>
                    </span>
                  ) : (
                    <span className="text-slate-500 italic">Tidak ada (mode tanpa auth / lokal)</span>
                  )}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-400 font-mono">NINEROUTER_MODEL</span>
                <span className="font-mono px-2 py-0.5 rounded bg-slate-800 text-indigo-300 border border-slate-700">
                  {status?.model || 'openai/gpt-4o'}
                </span>
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-slate-400 font-mono">Active Provider</span>
                <span className="font-bold text-white uppercase px-2 py-0.5 rounded bg-slate-800">
                  {status?.activeProvider || 'gemini'}
                </span>
              </div>
            </div>
          </div>

          {/* Model Catalog from 9Router if available */}
          {status?.availableModels && status.availableModels.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Model Tersedia di 9Router Gateway ({status.availableModels.length})
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2.5 rounded-lg bg-slate-800/40 border border-slate-700/60">
                {status.availableModels.map((m) => (
                  <span
                    key={m}
                    className={`text-[11px] font-mono px-2 py-0.5 rounded border ${
                      m === status.model
                        ? 'bg-indigo-900/60 border-indigo-500 text-indigo-200 font-bold'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quick Explainer */}
          <div className="text-xs text-slate-400 bg-slate-800/30 p-3.5 rounded-xl border border-slate-800 space-y-1.5">
            <div className="font-semibold text-slate-300 flex items-center space-x-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Kelebihan Integrasi 9Router pada TaniAI:</span>
            </div>
            <p className="leading-relaxed">
              1. <strong>Toleransi Kegagalan Tinggi:</strong> Apabila satu provider AI mengalami lonjakan latensi atau kuota habis, 9Router otomatis mengalihkan ke provider berikutnya tanpa mengganggu obrolan petani di WhatsApp.
            </p>
            <p className="leading-relaxed">
              2. <strong>Multi-Model:</strong> Mendukung model OpenAI, Anthropic Claude, Google Gemini, dan Llama secara terpadu melalui endpoint OpenAI standard (<code className="text-indigo-300 font-mono">/v1/chat/completions</code>).
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-800/80 border-t border-slate-700/80 flex items-center justify-between">
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>TaniAI Auto-Failover Engine: Online</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
