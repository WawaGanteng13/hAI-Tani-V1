import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Bell,
  Send,
  CheckCircle2,
  Sliders,
  Sparkles,
  Info,
  Calendar,
  MessageCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  ShieldAlert,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { MarketCommodity, AnomalyNotification, FarmerRecord } from '../types';

interface MarketAnomalyViewProps {
  commodities: MarketCommodity[];
  notifications: AnomalyNotification[];
  farmers: FarmerRecord[];
  onUpdateCommodityPrice: (id: string, newPrice: number, reason: string) => Promise<void>;
  onBroadcastNotification: (commodityId: string) => Promise<void>;
}

export const MarketAnomalyView: React.FC<MarketAnomalyViewProps> = ({
  commodities,
  notifications,
  farmers,
  onUpdateCommodityPrice,
  onBroadcastNotification,
}) => {
  const [selectedCommodity, setSelectedCommodity] = useState<MarketCommodity>(commodities[0] || {} as MarketCommodity);
  const [customPriceInput, setCustomPriceInput] = useState<number>(commodities[0]?.hargaSekarang || 75000);
  const [customReason, setCustomReason] = useState<string>('Gagal panen sentra Blitar akibat curah hujan tinggi');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [broadcastSuccess, setBroadcastSuccess] = useState<string | null>(null);

  // Sync selected commodity if commodities update
  const currentCommodity = commodities.find((c) => c.id === selectedCommodity.id) || commodities[0];

  const handleSelect = (comm: MarketCommodity) => {
    setSelectedCommodity(comm);
    setCustomPriceInput(comm.hargaSekarang);
  };

  const handleApplySimulatedPrice = async (deltaPercent: number) => {
    if (!currentCommodity) return;
    const targetPrice = Math.round(currentCommodity.hargaKemarin * (1 + deltaPercent / 100));
    setCustomPriceInput(targetPrice);
    setIsUpdating(true);
    await onUpdateCommodityPrice(
      currentCommodity.id,
      targetPrice,
      deltaPercent > 0 ? 'Simulasi lonjakan permintaan pasar' : 'Simulasi panen raya banjir pasokan'
    );
    setIsUpdating(false);
  };

  const handleApplyCustomPrice = async () => {
    if (!currentCommodity || !customPriceInput) return;
    setIsUpdating(true);
    await onUpdateCommodityPrice(currentCommodity.id, customPriceInput, customReason);
    setIsUpdating(false);
  };

  const handleBroadcast = async (commId: string) => {
    setIsBroadcasting(true);
    await onBroadcastNotification(commId);
    setIsBroadcasting(false);
    setBroadcastSuccess(`Notifikasi WhatsApp anomali harga berhasil dibroadcast ke seluruh petani terkait!`);
    setTimeout(() => setBroadcastSuccess(null), 5000);
  };

  // Find affected farmers for the current commodity
  const affectedFarmers = farmers.filter((f) =>
    f.komoditas.toLowerCase().includes(currentCommodity.nama.toLowerCase().split(' ')[0])
  );

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      {/* Top Banner */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center font-bold">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                <span>Deteksi Anomali Harga & Notifikasi Otomatis WhatsApp</span>
                <span className="bg-rose-100 text-rose-800 text-xs px-2.5 py-0.5 rounded-full font-medium border border-rose-200">
                  Threshold &plusmn;15%
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Sistem otomatis memantau harga komoditas strategis (PIHPS/Bapanas) dan menyiarkan peringatan langsung ke nomor WhatsApp petani untuk perlindungan harga panen.
              </p>
            </div>
          </div>
        </div>

        {broadcastSuccess && (
          <div className="bg-emerald-50 border border-emerald-300 text-emerald-800 px-3 py-2 rounded-xl text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{broadcastSuccess}</span>
          </div>
        )}
      </div>

      {/* Commodity Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {commodities.map((comm) => {
          const isSelected = comm.id === currentCommodity.id;
          const isSurge = comm.statusAnomali === 'LONJAKAN_EKSTREM';
          const isDrop = comm.statusAnomali === 'PENURUNAN_DRASTIS';
          const isWarning = comm.statusAnomali === 'PERINGATAN_FLUKTUASI';

          return (
            <div
              key={comm.id}
              onClick={() => handleSelect(comm)}
              className={`p-3.5 rounded-2xl border transition cursor-pointer relative ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/40 ring-2 ring-emerald-500/20 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              {/* Badge Anomali */}
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wide">
                  {comm.kategori}
                </span>
                {isSurge ? (
                  <span className="text-[10px] font-bold bg-rose-500 text-white px-1.5 py-0.5 rounded flex items-center space-x-0.5 animate-pulse">
                    <ArrowUpRight className="w-3 h-3" />
                    <span>Lonjakan</span>
                  </span>
                ) : isDrop ? (
                  <span className="text-[10px] font-bold bg-amber-500 text-white px-1.5 py-0.5 rounded flex items-center space-x-0.5 animate-pulse">
                    <ArrowDownRight className="w-3 h-3" />
                    <span>Anjlok</span>
                  </span>
                ) : isWarning ? (
                  <span className="text-[10px] font-semibold bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded">
                    Fluktuatif
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                    Normal
                  </span>
                )}
              </div>

              <h4 className="font-bold text-slate-900 text-sm truncate">{comm.nama}</h4>

              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-base font-extrabold text-slate-900 font-mono">
                    Rp {comm.hargaSekarang.toLocaleString('id-ID')}
                  </span>
                  <span className="text-[10px] text-slate-500">/kg</span>
                </div>
                <div
                  className={`text-xs font-bold font-mono flex items-center ${
                    comm.perubahanPersen > 0
                      ? 'text-rose-600'
                      : comm.perubahanPersen < 0
                      ? 'text-amber-600'
                      : 'text-slate-500'
                  }`}
                >
                  {comm.perubahanPersen > 0 ? `+${comm.perubahanPersen}%` : `${comm.perubahanPersen}%`}
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500 flex justify-between">
                <span>HAP: Rp {comm.hargaAcuanPemerintah.toLocaleString('id-ID')}</span>
                <span>{comm.tanggalUpdate}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Focus Detail: Price Trend & Broadcast WhatsApp Center */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: 7-Day Chart & Anomaly Analysis */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-base text-slate-900">{currentCommodity.nama}</h3>
                <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {currentCommodity.daerahSampel}
                </span>
              </div>
              <p className="text-xs text-slate-500">Tren harga 7 hari terakhir (Pasar Induk & Sentra Produksi)</p>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-500">Harga Acuan Pemerintah (HAP)</div>
              <div className="font-mono font-bold text-sm text-slate-700">
                Rp {currentCommodity.hargaAcuanPemerintah.toLocaleString('id-ID')} /kg
              </div>
            </div>
          </div>

          {/* Recharts Line Chart */}
          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={currentCommodity.tren7Hari}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="tanggal" tick={{ fontSize: 11, fill: '#64748B' }} />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 11, fill: '#64748B' }}
                  tickFormatter={(val) => `Rp ${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip
                  formatter={(value: any) => [`Rp ${Number(value).toLocaleString('id-ID')}/kg`, 'Harga']}
                  contentStyle={{ backgroundColor: '#1E293B', borderRadius: '8px', color: '#fff', fontSize: '12px' }}
                />
                <Line
                  type="monotone"
                  dataKey="harga"
                  stroke={currentCommodity.perubahanPersen >= 0 ? '#E11D48' : '#D97706'}
                  strokeWidth={3}
                  dot={{ r: 4, fill: currentCommodity.perubahanPersen >= 0 ? '#E11D48' : '#D97706' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Anomaly Insight Banner */}
          <div
            className={`p-3.5 rounded-xl border text-xs leading-relaxed ${
              currentCommodity.statusAnomali === 'LONJAKAN_EKSTREM'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : currentCommodity.statusAnomali === 'PENURUNAN_DRASTIS'
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="font-bold flex items-center space-x-1.5 mb-1">
              <ShieldAlert className="w-4 h-4" />
              <span>Diagnosa Anomali Pasar: {currentCommodity.statusAnomali.replace('_', ' ')}</span>
            </div>
            <p className="mb-2">{currentCommodity.pesanAnomali}</p>
            <div className="pt-2 border-t border-black/10 flex items-start space-x-2">
              <span className="font-bold shrink-0">💡 Saran Aksi Petani:</span>
              <span>{currentCommodity.rekomendasiPetani}</span>
            </div>
          </div>

          {/* Price Simulation Controls */}
          <div className="pt-2 border-t border-slate-100">
            <h4 className="text-xs font-bold text-slate-700 flex items-center space-x-1.5 mb-2">
              <Sliders className="w-3.5 h-3.5 text-emerald-600" />
              <span>Simulasi Pengujian Anomali (Uji Coba Fluktuasi Pasar):</span>
            </h4>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleApplySimulatedPrice(35)}
                disabled={isUpdating}
                className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-semibold cursor-pointer transition"
              >
                +35% Lonjakan Ekstrem (Trigger Alert)
              </button>
              <button
                onClick={() => handleApplySimulatedPrice(-25)}
                disabled={isUpdating}
                className="px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold cursor-pointer transition"
              >
                -25% Anjlok Panen Raya (Trigger Warning)
              </button>
              <button
                onClick={() => handleApplySimulatedPrice(0)}
                disabled={isUpdating}
                className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold cursor-pointer transition"
              >
                Normalisasi Harga
              </button>
            </div>
          </div>
        </div>

        {/* Right: Automated WhatsApp Broadcast Center */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-900">Broadcast WhatsApp Otomatis</h3>
                  <p className="text-[11px] text-slate-500">Notifikasi proaktif langsung ke ponsel petani</p>
                </div>
              </div>
              <span className="bg-emerald-50 text-emerald-700 text-[10px] font-mono px-2 py-0.5 rounded-full border border-emerald-200">
                Ready
              </span>
            </div>

            {/* Target Farmers Count */}
            <div className="mt-4 bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Target Petani Komoditas Ini:</span>
                <span className="font-bold text-slate-800">{affectedFarmers.length} Petani Terdaftar</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {affectedFarmers.length > 0
                  ? affectedFarmers.map((f) => f.nama).join(', ')
                  : 'Belum ada petani spesifik untuk komoditas ini, akan disiarkan ke kontak darurat poktan.'}
              </div>
            </div>

            {/* WhatsApp Message Preview Box */}
            <div className="mt-4">
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">
                Preview Pesan WhatsApp ke Petani:
              </label>
              <div className="bg-[#EFEAE2] p-3 rounded-xl border border-[#d8d3ca] text-xs font-sans whitespace-pre-line text-slate-800 leading-relaxed shadow-inner">
                {`📢 *[TaniAI ALERT HARGA PASAR]*
Yth. Bpk/Ibu Petani ${currentCommodity.nama},

Terdeteksi anomali pada harga pasar hari ini:
💰 Harga Terkini: *Rp ${currentCommodity.hargaSekarang.toLocaleString('id-ID')}/kg* (${currentCommodity.perubahanPersen >= 0 ? '+' : ''}${currentCommodity.perubahanPersen}%)
📍 Sampel Pasar: ${currentCommodity.daerahSampel}

💡 *Rekomendasi Strategis:*
${currentCommodity.rekomendasiPetani}

_Pesan otomatis dari Sistem Pemantauan TaniAI & Google Sheets._`}
              </div>
            </div>
          </div>

          {/* Broadcast Trigger Button */}
          <div className="pt-3 border-t border-slate-100">
            <button
              onClick={() => handleBroadcast(currentCommodity.id)}
              disabled={isBroadcasting}
              className="w-full py-3 px-4 bg-[#128C7E] hover:bg-[#075E54] text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center space-x-2 transition shadow-md cursor-pointer disabled:opacity-50"
            >
              <Send className={`w-4 h-4 ${isBroadcasting ? 'animate-pulse' : ''}`} />
              <span>
                {isBroadcasting
                  ? 'Mengirimkan Siaran WhatsApp...'
                  : `Kirim Peringatan ke ${Math.max(affectedFarmers.length, 1)} Petani`}
              </span>
            </button>
            <p className="text-[10px] text-slate-400 text-center mt-1.5">
              Notifikasi disalurkan melalui Meta WhatsApp Business API webhook queue.
            </p>
          </div>
        </div>
      </div>

      {/* History of Sent Notifications */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
        <div className="flex items-center space-x-2 pb-3 border-b border-slate-100 mb-4">
          <Clock className="w-4 h-4 text-slate-500" />
          <h3 className="font-bold text-sm text-slate-800">Riwayat Pengiriman Notifikasi Anomali Otomatis</h3>
        </div>

        <div className="space-y-2.5">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="p-3 rounded-xl border border-slate-200 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs gap-2"
            >
              <div className="flex items-start space-x-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 ${
                    notif.tipeAnomali === 'LONJAKAN_EKSTREM'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {notif.komoditas}
                </span>
                <p className="text-slate-700 leading-snug line-clamp-2 max-w-2xl">{notif.pesanPeringatan}</p>
              </div>

              <div className="flex items-center space-x-4 shrink-0 text-slate-500 text-[11px] self-end sm:self-center">
                <span>{notif.waktuKirim}</span>
                <span className="font-semibold text-emerald-700 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>{notif.status} ({notif.jumlahPetaniTerdampak} petani)</span>
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
