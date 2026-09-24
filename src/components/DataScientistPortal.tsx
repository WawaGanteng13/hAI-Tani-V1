import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Sparkles,
  RefreshCw,
  TrendingUp,
  AlertCircle,
  FileText,
  Printer,
  Copy,
  CheckCircle2,
  PieChart as PieIcon,
  BarChart3,
  Calendar,
  Layers,
  MapPin,
  ShieldCheck,
  Check,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from 'recharts';
import { FarmerRecord, StrategicRecommendation, MarketCommodity } from '../types';

interface DataScientistPortalProps {
  farmers: FarmerRecord[];
  commodities: MarketCommodity[];
  recommendation: StrategicRecommendation;
  onGenerateNewRecommendation: () => Promise<void>;
  loading: boolean;
}

const COLORS = ['#059669', '#2563EB', '#D97706', '#DC2626', '#7C3AED', '#0D9488'];

export const DataScientistPortal: React.FC<DataScientistPortalProps> = ({
  farmers,
  commodities,
  recommendation,
  onGenerateNewRecommendation,
  loading,
}) => {
  const [copied, setCopied] = useState(false);

  // Compute aggregations
  const totalLahan = farmers.reduce((acc, f) => acc + (f.luasLahan || 0), 0);
  const totalPanen = farmers.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0);

  // Harvest per commodity
  const harvestByCrop: { [crop: string]: { ton: number; ha: number; count: number } } = {};
  farmers.forEach((f) => {
    const key = f.komoditas.split(' ')[0];
    if (!harvestByCrop[key]) {
      harvestByCrop[key] = { ton: 0, ha: 0, count: 0 };
    }
    harvestByCrop[key].ton += f.estimasiHasilTon || 0;
    harvestByCrop[key].ha += f.luasLahan || 0;
    harvestByCrop[key].count += 1;
  });

  const chartCropData = Object.entries(harvestByCrop).map(([crop, data]) => ({
    name: crop,
    ton: Number(data.ton.toFixed(1)),
    ha: Number(data.ha.toFixed(1)),
    petani: data.count,
  }));

  // Geographic distribution
  const geoMap: { [geo: string]: number } = {};
  farmers.forEach((f) => {
    const region = f.kabupaten ? f.kabupaten.split(',')[0].trim() : 'Lainnya';
    geoMap[region] = (geoMap[region] || 0) + (f.luasLahan || 0);
  });

  const chartGeoData = Object.entries(geoMap).map(([region, ha]) => ({
    name: region,
    value: Number(ha.toFixed(1)),
  }));

  // Korelasi Pearson luas vs ton (API stdlib).
  const [corr, setCorr] = useState<{ n: number; r: number } | null>(null);
  useEffect(() => {
    fetch('/api/analytics/correlation').then((r) => r.json()).then(setCorr).catch(() => {});
  }, [farmers.length]);

  const handleCopyReport = () => {
    const text = `LAPORAN STRATEGIS DATA SCIENTIST PERTANIAN - TANIAI
Tanggal: ${recommendation.tanggal}
Judul: ${recommendation.judul}
Urgensi: ${recommendation.urgensi}

RINGKASAN EKSEKUTIF:
${recommendation.ringkasanEksekutif}

ANALISIS RISIKO PASOKAN:
${recommendation.analisisOversupplyShortage.map((item, i) => `${i + 1}. ${item}`).join('\n')}

REKOMENDASI AGRONOMI:
${recommendation.rekomendasiAgronomi.map((item, i) => `${i + 1}. ${item}`).join('\n')}

REKOMENDASI KEBIJAKAN HARGA:
${recommendation.rekomendasiKebijakanHarga.map((item, i) => `${i + 1}. ${item}`).join('\n')}

REKOMENDASI RANTAI PASOK:
${recommendation.rekomendasiRantaiPasok.map((item, i) => `${i + 1}. ${item}`).join('\n')}

CATATAN METODOLOGI DATA SCIENTIST:
${recommendation.dataScientistNotes}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="app-shell space-y-6 animate-fade-in">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500 text-white flex items-center justify-center font-bold shadow-md shadow-indigo-500/30">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <span>Portal Data Scientist & Analisis Strategis Pertanian</span>
                <span className="bg-indigo-500/20 text-indigo-300 text-xs px-2.5 py-0.5 rounded-full font-medium border border-indigo-400/30">
                  Gemini AI Agronomist
                </span>
              </h2>
              <p className="text-xs text-slate-300">
                Pusat pengolahan data digital petani untuk menyusun strategi stabilisasi harga, intervensi logistik, dan peningkatan kesejahteraan petani.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onGenerateNewRecommendation}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-emerald-600 hover:from-indigo-500 hover:to-emerald-500 text-white font-semibold text-xs transition cursor-pointer flex items-center space-x-2 shadow-lg shadow-indigo-500/20 disabled:opacity-50"
          >
            <Sparkles className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Menganalisis Data Petani...' : 'Jalankan Analisis AI Terbaru'}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card card-hover p-4">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
            <span>Total Petani Terdata</span>
            <span className="p-1 rounded-md bg-emerald-50 text-emerald-700">👤</span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{farmers.length}</div>
          <div className="text-[11px] text-emerald-600 mt-1 flex items-center space-x-1">
            <span>100% Tercatat via WhatsApp</span>
          </div>
        </div>

        <div className="card card-hover p-4">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
            <span>Total Lahan Pertanian</span>
            <span className="p-1 rounded-md bg-blue-50 text-blue-700">📐</span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalLahan.toFixed(1)} Ha</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rata-rata: {(totalLahan / (farmers.length || 1)).toFixed(2)} Ha / petani
          </div>
        </div>

        <div className="card card-hover p-4">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
            <span>Estimasi Akumulasi Panen</span>
            <span className="p-1 rounded-md bg-amber-50 text-amber-700">🌾</span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalPanen.toFixed(1)} Ton</div>
          <div className="text-[11px] text-amber-600 mt-1">
            Periode panen: Q4 2026 - Q1 2027
          </div>
        </div>

        <div className="card card-hover p-4">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
            <span>Komoditas Aktif</span>
            <span className="p-1 rounded-md bg-purple-50 text-purple-700">🌱</span>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{chartCropData.length}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Padi, Cabai, Bawang, Jagung
          </div>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Bar Chart Panen per Komoditas */}
        <div className="lg:col-span-7 card p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-emerald-600" />
              <h3 className="font-bold text-sm text-slate-800">Proyeksi Hasil Panen per Komoditas (Ton)</h3>
            </div>
            <span className="text-[11px] text-slate-500">Agregasi Real-Time</span>
          </div>

          <div className="h-64 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartCropData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip
                  formatter={(val: any) => [`${val} Ton`, 'Estimasi Panen']}
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Bar dataKey="ton" fill="#059669" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="text-xs text-slate-500 flex flex-wrap gap-4 pt-1">
            {chartCropData.map((c) => (
              <div key={c.name} className="flex items-center space-x-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                <span>{c.name}: <strong>{c.ton} Ton</strong> ({c.ha} Ha)</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Pie Chart Sebaran Wilayah */}
        <div className="lg:col-span-5 card p-5 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center space-x-2">
              <MapPin className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-sm text-slate-800">Distribusi Luas Lahan Wilayah (Ha)</h3>
            </div>
            <span className="text-[11px] text-slate-500">Sebaran Spasial</span>
          </div>

          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartGeoData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >

      <div className="card p-3 text-xs text-slate-600 flex items-center justify-between">
        <span><strong>Korelasi luas-ton (Pearson):</strong> <span className="num font-bold">{corr ? corr.r : '...'}</span> <span className="text-slate-400">n={corr ? corr.n : '...'}</span></span>
        <span className="text-slate-400">r~1 = tonase ikut luas lahan</span>
      </div>
                  {chartGeoData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any) => [`${val} Ha`, 'Luas Lahan']}
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Strategic Report by Gemini AI */}
      <div className="card p-6 border border-slate-200 shadow-md space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-200 gap-3">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800">
                Urgensi: {recommendation.urgensi}
              </span>
              <span className="text-xs text-slate-500">{recommendation.tanggal}</span>
            </div>
            <h3 className="text-lg font-bold text-slate-900 mt-1">{recommendation.judul}</h3>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyReport}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer flex items-center space-x-1"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Tersalin!' : 'Salin Laporan'}</span>
            </button>
            <button
              onClick={handlePrint}
              className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-medium transition cursor-pointer flex items-center space-x-1"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Cetak / PDF</span>
            </button>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-4 text-xs sm:text-sm text-indigo-950 leading-relaxed">
          <div className="font-bold flex items-center space-x-1.5 text-indigo-900 mb-1.5">
            <FileText className="w-4 h-4 text-indigo-700" />
            <span>Ringkasan Eksekutif bagi Data Scientist & Pengambil Kebijakan:</span>
          </div>
          <p>{recommendation.ringkasanEksekutif}</p>
        </div>

        {/* 3 Columns: Oversupply Risk, Agronomy, Pricing/Supply Chain */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Col 1: Analisis Pasokan & Titik Rawan */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-rose-800 flex items-center space-x-1.5 mb-3">
              <AlertCircle className="w-4 h-4 text-rose-600" />
              <span>1. Analisis Oversupply & Shortage</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-700">
              {recommendation.analisisOversupplyShortage.map((item, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="text-rose-500 font-bold shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 2: Rekomendasi Agronomi Lapangan */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-emerald-800 flex items-center space-x-1.5 mb-3">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>2. Rekomendasi Agronomi & Budidaya</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-700">
              {recommendation.rekomendasiAgronomi.map((item, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="text-emerald-600 font-bold shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Kebijakan Harga & Rantai Pasok */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200">
            <h4 className="font-bold text-xs uppercase tracking-wider text-blue-800 flex items-center space-x-1.5 mb-3">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <span>3. Kebijakan Harga & Rantai Pasok</span>
            </h4>
            <ul className="space-y-2 text-xs text-slate-700">
              {recommendation.rekomendasiKebijakanHarga.map((item, i) => (
                <li key={i} className="flex items-start space-x-2">
                  <span className="text-blue-500 font-bold shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
              {recommendation.rekomendasiRantaiPasok.map((item, i) => (
                <li key={`rp-${i}`} className="flex items-start space-x-2">
                  <span className="text-indigo-500 font-bold shrink-0">•</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Data Scientist Analytic Notes */}
        <div className="p-3.5 rounded-xl bg-slate-100 border border-slate-200 text-xs text-slate-600">
          <span className="font-bold text-slate-800">Catatan Metodologi Data Scientist: </span>
          {recommendation.dataScientistNotes}
        </div>
      </div>
    </div>
  );
};
