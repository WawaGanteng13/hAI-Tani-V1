import React from 'react';
import { Sprout, MessageSquare, Table, TrendingUp, Cpu, Radio, BarChart3, MapPin } from 'lucide-react';

interface HeaderProps {
  activeTab: 'dashboard' | 'chat' | 'sheets' | 'market' | 'datascientist' | 'map';
  setActiveTab: (tab: 'dashboard' | 'chat' | 'sheets' | 'market' | 'datascientist' | 'map') => void;
  onOpenWebhookModal: () => void;
  onOpenAdminModal?: () => void;
  onOpenNineRouterModal?: () => void;
  farmersCount: number;
  anomaliesCount: number;
  adminsCount?: number;
  nineRouterActive?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  setActiveTab,
  onOpenWebhookModal,
  onOpenAdminModal,
  onOpenNineRouterModal,
  farmersCount,
  anomaliesCount,
  adminsCount = 3,
  nineRouterActive = false,
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sprout className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">TaniAI</span>
                <span className="text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Agri-Agent 2.5
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                WhatsApp Chatbot &bull; Google Sheets Real-Time &bull; Analisis Data Scientist
              </p>
            </div>
          </div>

          {/* Quick status & Webhook action & Admin RBAC */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {onOpenNineRouterModal && (
              <button
                onClick={onOpenNineRouterModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 text-xs font-medium transition cursor-pointer shadow-xs"
                title="Status Integrasi 9Router AI Gateway"
              >
                <Cpu className={`w-3.5 h-3.5 ${nineRouterActive ? 'text-indigo-400 animate-pulse' : 'text-slate-400'}`} />
                <span className="hidden sm:inline">9Router:</span>
                <span className={`font-mono px-1.5 py-0.2 rounded font-bold text-[11px] ${
                  nineRouterActive ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-800 text-slate-400'
                }`}>
                  {nineRouterActive ? 'Gateway' : 'Failover'}
                </span>
              </button>
            )}

            {onOpenAdminModal && (
              <button
                onClick={onOpenAdminModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-700/60 text-xs font-medium transition cursor-pointer shadow-xs"
                title="Kelola Nomor Admin WhatsApp yang Dikenali Tani AI"
              >
                <span className="text-amber-400">🛡️</span>
                <span className="hidden sm:inline">Nomor Admin:</span>
                <span className="font-mono bg-amber-900/90 text-amber-200 px-1.5 py-0.2 rounded font-bold">
                  {adminsCount}
                </span>
              </button>
            )}

            <button
              onClick={onOpenWebhookModal}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/50 text-xs font-medium transition cursor-pointer"
              title="Integrasi Webhook WhatsApp"
            >
              <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              <span className="hidden md:inline">Webhook WA:</span>
              <span className="font-mono text-emerald-200">Active</span>
            </button>

            <div className="hidden lg:flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-slate-300">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-ping" />
              <span>Sheets Sync:</span>
              <span className="font-semibold text-emerald-400">Connected</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-2 scrollbar-none">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'dashboard'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4 text-emerald-300" />
            <span>Dashboard Profesional</span>
            <span className="bg-emerald-500/30 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold">
              Analitik
            </span>
          </button>

          <button
            onClick={() => setActiveTab('sheets')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'sheets'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>Database Google Sheets</span>
            <span className="bg-slate-700 text-slate-200 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              {farmersCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'chat'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>Chatbot WhatsApp</span>
            <span className="bg-emerald-800/80 text-emerald-200 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              Live
            </span>
          </button>

          <button
            onClick={() => setActiveTab('market')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'market'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Anomali Harga & Notifikasi</span>
            {anomaliesCount > 0 && (
              <span className="bg-rose-500 text-white text-[10px] px-1.5 py-0.2 rounded-full font-bold animate-pulse">
                {anomaliesCount} Anomali
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('datascientist')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'datascientist'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-700/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Cpu className="w-4 h-4 text-indigo-300" />
            <span>Portal Data Scientist & Rekomendasi</span>
            <span className="bg-indigo-900/80 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
              AI
            </span>
          </button>

          <button
            onClick={() => setActiveTab('map')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-medium transition whitespace-nowrap cursor-pointer ${
              activeTab === 'map'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/20'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            <MapPin className="w-4 h-4 text-emerald-300" />
            <span>Peta Sebaran Petani & Supplier</span>
            <span className="bg-emerald-500/30 text-emerald-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono font-semibold">
              Maps
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};
