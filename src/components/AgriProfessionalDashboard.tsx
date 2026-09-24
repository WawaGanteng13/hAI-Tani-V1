import React, { useState, useMemo } from 'react';
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Calendar,
  Layers,
  MapPin,
  Filter,
  ArrowUpDown,
  Download,
  Printer,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  FileText,
  Search,
  CheckCircle2,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Coins,
  Sprout,
  Users,
  Maximize2,
  Minimize2,
  Table as TableIcon,
  Info,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
  ComposedChart,
} from 'recharts';
import { FarmerRecord, MarketCommodity, StrategicRecommendation } from '../types';

interface AgriProfessionalDashboardProps {
  farmers: FarmerRecord[];
  commodities: MarketCommodity[];
  recommendation: StrategicRecommendation;
  onRefreshData: () => Promise<void>;
  loading: boolean;
  onNavigateToSheets: () => void;
  onNavigateToChat: () => void;
  onNavigateToMap?: () => void;
}

const PALETTE = {
  emerald: '#059669',
  teal: '#0D9488',
  blue: '#2563EB',
  amber: '#D97706',
  rose: '#E11D48',
  indigo: '#4F46E5',
  purple: '#7C3AED',
  slate: '#64748B',
};

const PIE_COLORS = ['#059669', '#2563EB', '#D97706', '#E11D48', '#7C3AED', '#0D9488', '#F59E0B'];

export const AgriProfessionalDashboard: React.FC<AgriProfessionalDashboardProps> = ({
  farmers,
  commodities,
  recommendation,
  onRefreshData,
  loading,
  onNavigateToSheets,
  onNavigateToChat,
  onNavigateToMap,
}) => {
  // Filter States
  const [selectedCommodity, setSelectedCommodity] = useState<string>('all');
  const [selectedRegion, setSelectedRegion] = useState<string>('all');
  const [selectedHarvestMonth, setSelectedHarvestMonth] = useState<string>('all');
  const [selectedScale, setSelectedScale] = useState<string>('all'); // 'all' | 'small' | 'medium' | 'large'
  const [selectedVerification, setSelectedVerification] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sorting State
  const [sortBy, setSortBy] = useState<'yield' | 'land' | 'harvest' | 'name' | 'value'>('yield');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // View toggles
  const [activeCommodityForPriceTrend, setActiveCommodityForPriceTrend] = useState<string>(
    commodities[0]?.id || 'comm-1'
  );
  const [selectedFarmerDetail, setSelectedFarmerDetail] = useState<FarmerRecord | null>(null);
  const [showExecutiveBriefing, setShowExecutiveBriefing] = useState<boolean>(false);
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Derive unique filter options from live data
  const regions = useMemo(() => {
    const set = new Set<string>();
    farmers.forEach((f) => {
      if (f.kabupaten) {
        const kab = f.kabupaten.split(',')[0].trim();
        if (kab) set.add(kab);
      }
    });
    return Array.from(set).sort();
  }, [farmers]);

  const commodityOptions = useMemo(() => {
    const set = new Set<string>();
    farmers.forEach((f) => {
      if (f.komoditas) set.add(f.komoditas);
    });
    return Array.from(set).sort();
  }, [farmers]);

  const harvestMonthOptions = useMemo(() => {
    const set = new Set<string>();
    farmers.forEach((f) => {
      if (f.estimasiPanen) set.add(f.estimasiPanen);
    });
    return Array.from(set).sort();
  }, [farmers]);

  // Helper map: commodity name -> price per kg
  const commodityPriceMap = useMemo(() => {
    const map = new Map<string, number>();
    commodities.forEach((c) => {
      map.set(c.nama.toLowerCase(), c.hargaSekarang);
      // Also index by common prefixes
      if (c.nama.includes('Padi') || c.nama.includes('Beras')) map.set('padi', c.hargaSekarang);
      if (c.nama.includes('Cabai Rawit')) map.set('cabai rawit merah', c.hargaSekarang);
      if (c.nama.includes('Cabai Merah Keriting')) map.set('cabai merah keriting', c.hargaSekarang);
      if (c.nama.includes('Bawang Merah')) map.set('bawang merah', c.hargaSekarang);
      if (c.nama.includes('Jagung')) map.set('jagung', c.hargaSekarang);
    });
    return map;
  }, [commodities]);

  const getCommodityPrice = (cropName: string): number => {
    const clean = cropName.toLowerCase().trim();
    if (commodityPriceMap.has(clean)) return commodityPriceMap.get(clean)!;
    for (const [key, val] of commodityPriceMap.entries()) {
      if (clean.includes(key) || key.includes(clean)) return val;
    }
    return 10000; // fallback standard
  };

  // Filtered dataset
  const filteredFarmers = useMemo(() => {
    return farmers.filter((f) => {
      // Commodity Filter
      if (selectedCommodity !== 'all' && f.komoditas !== selectedCommodity) return false;

      // Region Filter
      if (selectedRegion !== 'all') {
        const kab = f.kabupaten ? f.kabupaten.split(',')[0].trim() : '';
        if (kab !== selectedRegion) return false;
      }

      // Harvest Month Filter
      if (selectedHarvestMonth !== 'all' && f.estimasiPanen !== selectedHarvestMonth) return false;

      // Farm Scale Filter (<1ha = small, 1-2ha = medium, >2ha = large)
      if (selectedScale === 'small' && f.luasLahan >= 1.0) return false;
      if (selectedScale === 'medium' && (f.luasLahan < 1.0 || f.luasLahan > 2.0)) return false;
      if (selectedScale === 'large' && f.luasLahan <= 2.0) return false;

      // Verification Status Filter
      if (selectedVerification !== 'all' && f.statusVerifikasi !== selectedVerification) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = f.nama.toLowerCase().includes(q);
        const matchLoc = f.alamat.toLowerCase().includes(q) || (f.kabupaten && f.kabupaten.toLowerCase().includes(q));
        const matchCrop = f.komoditas.toLowerCase().includes(q) || (f.varietas && f.varietas.toLowerCase().includes(q));
        const matchNotes = f.catatanAI && f.catatanAI.toLowerCase().includes(q);
        if (!matchName && !matchLoc && !matchCrop && !matchNotes) return false;
      }

      return true;
    });
  }, [
    farmers,
    selectedCommodity,
    selectedRegion,
    selectedHarvestMonth,
    selectedScale,
    selectedVerification,
    searchQuery,
  ]);

  // Sorted dataset
  const sortedAndFilteredFarmers = useMemo(() => {
    const list = [...filteredFarmers];
    list.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'yield') {
        comparison = (a.estimasiHasilTon || 0) - (b.estimasiHasilTon || 0);
      } else if (sortBy === 'land') {
        comparison = (a.luasLahan || 0) - (b.luasLahan || 0);
      } else if (sortBy === 'harvest') {
        comparison = a.estimasiPanen.localeCompare(b.estimasiPanen);
      } else if (sortBy === 'name') {
        comparison = a.nama.localeCompare(b.nama);
      } else if (sortBy === 'value') {
        const valA = (a.estimasiHasilTon || 0) * 1000 * getCommodityPrice(a.komoditas);
        const valB = (b.estimasiHasilTon || 0) * 1000 * getCommodityPrice(b.komoditas);
        comparison = valA - valB;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
    return list;
  }, [filteredFarmers, sortBy, sortOrder, commodityPriceMap]);

  // Key KPI Aggregations on filtered data
  const totalFilteredFarmers = filteredFarmers.length;
  const totalFilteredLand = filteredFarmers.reduce((acc, f) => acc + (f.luasLahan || 0), 0);
  const totalFilteredYield = filteredFarmers.reduce((acc, f) => acc + (f.estimasiHasilTon || 0), 0);
  const averageLandHolding = totalFilteredFarmers > 0 ? totalFilteredLand / totalFilteredFarmers : 0;
  const overallYieldPerHectare = totalFilteredLand > 0 ? totalFilteredYield / totalFilteredLand : 0;

  // Valuation Calculation: Ton * 1000 kg * Price/kg
  const totalFilteredValuation = useMemo(() => {
    return filteredFarmers.reduce((acc, f) => {
      const price = getCommodityPrice(f.komoditas);
      return acc + (f.estimasiHasilTon || 0) * 1000 * price;
    }, 0);
  }, [filteredFarmers, commodityPriceMap]);

  // Demographics: Farm Scale Distribution
  const scaleDistribution = useMemo(() => {
    let small = 0;
    let medium = 0;
    let large = 0;
    filteredFarmers.forEach((f) => {
      if (f.luasLahan < 1.0) small++;
      else if (f.luasLahan <= 2.0) medium++;
      else large++;
    });
    return [
      { name: 'Gurem (< 1.0 Ha)', count: small, percent: totalFilteredFarmers ? (small / totalFilteredFarmers) * 100 : 0 },
      { name: 'Menengah (1.0 - 2.0 Ha)', count: medium, percent: totalFilteredFarmers ? (medium / totalFilteredFarmers) * 100 : 0 },
      { name: 'Komersial (> 2.0 Ha)', count: large, percent: totalFilteredFarmers ? (large / totalFilteredFarmers) * 100 : 0 },
    ];
  }, [filteredFarmers, totalFilteredFarmers]);

  // Demographics: Regional Breakdown
  const regionalDemographics = useMemo(() => {
    const map = new Map<string, { farmersCount: number; landHa: number; yieldTon: number }>();
    filteredFarmers.forEach((f) => {
      const region = f.kabupaten ? f.kabupaten.split(',')[0].trim() : 'Lainnya';
      const cur = map.get(region) || { farmersCount: 0, landHa: 0, yieldTon: 0 };
      cur.farmersCount += 1;
      cur.landHa += f.luasLahan || 0;
      cur.yieldTon += f.estimasiHasilTon || 0;
      map.set(region, cur);
    });
    return Array.from(map.entries())
      .map(([region, data]) => ({
        region,
        petani: data.farmersCount,
        lahan: Number(data.landHa.toFixed(1)),
        panen: Number(data.yieldTon.toFixed(1)),
        avgLahan: Number((data.landHa / data.farmersCount).toFixed(2)),
      }))
      .sort((a, b) => b.lahan - a.lahan);
  }, [filteredFarmers]);

  // Crop Distribution & Land Usage
  const cropDistribution = useMemo(() => {
    const map = new Map<string, { count: number; landHa: number; yieldTon: number }>();
    filteredFarmers.forEach((f) => {
      const crop = f.komoditas;
      const cur = map.get(crop) || { count: 0, landHa: 0, yieldTon: 0 };
      cur.count += 1;
      cur.landHa += f.luasLahan || 0;
      cur.yieldTon += f.estimasiHasilTon || 0;
      map.set(crop, cur);
    });

    return Array.from(map.entries()).map(([crop, d]) => ({
      crop,
      petani: d.count,
      lahan: Number(d.landHa.toFixed(1)),
      panen: Number(d.yieldTon.toFixed(1)),
      produktivitas: d.landHa > 0 ? Number((d.yieldTon / d.landHa).toFixed(2)) : 0,
      shareLahan: totalFilteredLand > 0 ? Number(((d.landHa / totalFilteredLand) * 100).toFixed(1)) : 0,
    }));
  }, [filteredFarmers, totalFilteredLand]);

  // Harvest Estimates Timeline (Timeline by Month)
  const harvestTimeline = useMemo(() => {
    const map = new Map<string, { totalTon: number; totalHa: number; farmerCount: number }>();
    filteredFarmers.forEach((f) => {
      const month = f.estimasiPanen || 'Belum Ditentukan';
      const cur = map.get(month) || { totalTon: 0, totalHa: 0, farmerCount: 0 };
      cur.totalTon += f.estimasiHasilTon || 0;
      cur.totalHa += f.luasLahan || 0;
      cur.farmerCount += 1;
      map.set(month, cur);
    });

    // Custom sort chronological order if standard months
    const monthOrder = [
      'September 2026',
      'Oktober 2026',
      'November 2026',
      'Desember 2026',
      'Januari 2027',
      'Februari 2027',
      'Maret 2027',
    ];

    return Array.from(map.entries())
      .map(([period, data]) => ({
        period,
        ton: Number(data.totalTon.toFixed(1)),
        ha: Number(data.totalHa.toFixed(1)),
        petani: data.farmerCount,
        // Approximate safety absorption capacity for visual benchmarking (e.g. 30 ton threshold)
        kapasitasSerapanPasar: 32.0,
      }))
      .sort((a, b) => {
        const idxA = monthOrder.indexOf(a.period);
        const idxB = monthOrder.indexOf(b.period);
        if (idxA !== -1 && idxB !== -1) return idxA - idxB;
        return a.period.localeCompare(b.period);
      });
  }, [filteredFarmers]);

  // Active Commodity Trend for Market Comparison
  const activeCommodity = useMemo(() => {
    return commodities.find((c) => c.id === activeCommodityForPriceTrend) || commodities[0];
  }, [commodities, activeCommodityForPriceTrend]);

  // Export Filtered Table to CSV
  const exportToCSV = () => {
    if (sortedAndFilteredFarmers.length === 0) return;
    const headers = [
      'ID Petani',
      'Baris Google Sheet',
      'Nama Petani',
      'No WhatsApp',
      'Alamat',
      'Kabupaten',
      'Komoditas',
      'Varietas',
      'Luas Lahan (Ha)',
      'Estimasi Panen',
      'Taksiran Hasil (Ton)',
      'Status Verifikasi',
      'Estimasi Valuasi (Rp)',
      'Catatan Agronomi',
    ];

    const rows = sortedAndFilteredFarmers.map((f) => {
      const price = getCommodityPrice(f.komoditas);
      const val = (f.estimasiHasilTon || 0) * 1000 * price;
      return [
        f.id,
        f.googleSheetRow || '',
        `"${f.nama}"`,
        `"${f.noHp}"`,
        `"${f.alamat.replace(/"/g, '""')}"`,
        `"${f.kabupaten || ''}"`,
        `"${f.komoditas}"`,
        `"${f.varietas || ''}"`,
        f.luasLahan,
        `"${f.estimasiPanen}"`,
        f.estimasiHasilTon,
        `"${f.statusVerifikasi}"`,
        val,
        `"${(f.catatanAI || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute(
      'download',
      `TaniAI_Laporan_Profesional_Petani_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCopyReport = () => {
    const briefingText = `RINGKASAN EKSEKUTIF PROFESIONAL PERTANIAN (TANIAI DASHBOARD)
Terhubung ke Google Sheets: Database_Petani_Nasional_2026.gsheet
Tanggal Laporan: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}

1. INDIKATOR UTAMA
- Total Petani Dianalisis: ${totalFilteredFarmers} Petani
- Total Luas Lahan Terdata: ${totalFilteredLand.toFixed(1)} Ha (Rata-rata: ${averageLandHolding.toFixed(2)} Ha/petani)
- Estimasi Akumulasi Hasil Panen: ${totalFilteredYield.toFixed(1)} Ton
- Rata-rata Produktivitas Lahan: ${overallYieldPerHectare.toFixed(2)} Ton/Ha
- Proyeksi Nilai Ekonomi Panen: Rp ${totalFilteredValuation.toLocaleString('id-ID')}

2. SEBARAN DEMOGRAFI & SKALA KEPEMILIKAN
${scaleDistribution.map((s) => `- ${s.name}: ${s.count} petani (${s.percent.toFixed(1)}%)`).join('\n')}

3. SEBARAN KOMODITAS UTAMA
${cropDistribution.map((c) => `- ${c.crop}: ${c.lahan} Ha (${c.shareLahan}%), Estimasi: ${c.panen} Ton`).join('\n')}

4. ANALISIS JADWAL PANEN & KETAHANAN PASOKAN
${harvestTimeline.map((h) => `- ${h.period}: ${h.ton} Ton (${h.petani} Petani)`).join('\n')}

5. REKOMENDASI KEBIJAKAN & INTERVENSI LOGISTIK
- ${recommendation.ringkasanEksekutif}`;

    navigator.clipboard.writeText(briefingText);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const resetAllFilters = () => {
    setSelectedCommodity('all');
    setSelectedRegion('all');
    setSelectedHarvestMonth('all');
    setSelectedScale('all');
    setSelectedVerification('all');
    setSearchQuery('');
  };

  const hasActiveFilters =
    selectedCommodity !== 'all' ||
    selectedRegion !== 'all' ||
    selectedHarvestMonth !== 'all' ||
    selectedScale !== 'all' ||
    selectedVerification !== 'all' ||
    searchQuery.trim() !== '';

  return (
    <div className="max-w-7xl mx-auto py-4 space-y-6">
      {/* 1. Google Sheets Live Connection Bar */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 shadow-md">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-bold">
                <TableIcon className="w-4 h-4" />
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <span>Dashboard Analitik Profesional Pertanian</span>
                <span className="text-[11px] bg-emerald-950 text-emerald-300 border border-emerald-700/50 px-2.5 py-0.5 rounded-full font-mono flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  Google Sheet Connected
                </span>
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
              <span className="flex items-center gap-1 text-slate-400">
                <span className="font-semibold text-slate-200">Spreadsheet:</span> Petani_TaniAI_2026.gsheet
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="font-semibold text-slate-200">Worksheet:</span> Lahan_Petani_Master
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <span className="font-semibold text-slate-200">Status Data:</span> Real-Time Sync (Webhook On)
              </span>
              <span className="text-emerald-400 font-mono font-semibold">
                {farmers.length} Baris Data Tersinkronisasi
              </span>
            </div>
          </div>

          {/* Action Buttons for Google Sheets */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={onRefreshData}
              disabled={loading}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              title="Perbarui data terbaru dari Google Sheets"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${loading ? 'animate-spin' : ''}`} />
              <span>{loading ? 'Sinkronisasi...' : 'Tarik Data Terbaru'}</span>
            </button>

            <button
              onClick={onNavigateToSheets}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Tampilan Spreadsheet</span>
            </button>

            <button
              onClick={exportToCSV}
              className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
              title="Ekspor data hasil filter ke file CSV"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>

            {onNavigateToMap && (
              <button
                onClick={onNavigateToMap}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
                title="Buka Peta Spasial Sebaran Petani & Supplier di Google Maps"
              >
                <MapPin className="w-3.5 h-3.5" />
                <span>Peta Google Maps</span>
              </button>
            )}

            <button
              onClick={() => setShowExecutiveBriefing(!showExecutiveBriefing)}
              className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition flex items-center space-x-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{showExecutiveBriefing ? 'Tutup Ringkasan' : 'Briefing Eksekutif'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Collapsible Executive Briefing Section */}
      {showExecutiveBriefing && (
        <div className="bg-white rounded-2xl p-5 border border-indigo-200 shadow-sm space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-sm sm:text-base text-slate-900">
                Briefing Eksekutif Agronomis & Data Scientist (Siap Rapat)
              </h3>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleCopyReport}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center space-x-1 cursor-pointer"
              >
                {copiedReport ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <FileText className="w-3.5 h-3.5" />}
                <span>{copiedReport ? 'Tersalin!' : 'Salin Laporan'}</span>
              </button>
              <button
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center space-x-1 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak / PDF</span>
              </button>
            </div>
          </div>

          <div className="bg-indigo-50/60 rounded-xl p-4 text-xs text-indigo-950 space-y-2 border border-indigo-100">
            <p className="font-semibold leading-relaxed">
              Ringkasan Kebijakan Lapangan: Berdasarkan {totalFilteredFarmers} data petani aktif dengan luas akumulasi {totalFilteredLand.toFixed(1)} Ha, estimasi pasokan panen total mencapai {totalFilteredYield.toFixed(1)} Ton dengan valuasi ekonomi proyeksi Rp {totalFilteredValuation.toLocaleString('id-ID')}.
            </p>
            <p className="text-indigo-800">
              {recommendation.ringkasanEksekutif}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="font-bold text-rose-700 flex items-center space-x-1 mb-1.5">
                <AlertTriangle className="w-4 h-4" />
                <span>Risiko Volatilitas & Pasokan:</span>
              </div>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                {recommendation.analisisOversupplyShortage.slice(0, 2).map((item, idx) => (
                  <li key={idx} className="leading-snug">{item}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="font-bold text-emerald-700 flex items-center space-x-1 mb-1.5">
                <ShieldCheck className="w-4 h-4" />
                <span>Rekomendasi Agronomi:</span>
              </div>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                {recommendation.rekomendasiAgronomi.slice(0, 2).map((item, idx) => (
                  <li key={idx} className="leading-snug">{item}</li>
                ))}
              </ul>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
              <div className="font-bold text-blue-700 flex items-center space-x-1 mb-1.5">
                <TrendingUp className="w-4 h-4" />
                <span>Intervensi Rantai Pasok:</span>
              </div>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                {recommendation.rekomendasiRantaiPasok.slice(0, 2).map((item, idx) => (
                  <li key={idx} className="leading-snug">{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 2. Interactive Filter & Sorting Toolbar */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-sm text-slate-800">Filter & Pengurutan Data Lahan Petani</h3>
            <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-mono">
              Menampilkan {totalFilteredFarmers} dari {farmers.length} data
            </span>
          </div>
          {hasActiveFilters && (
            <button
              onClick={resetAllFilters}
              className="text-xs text-rose-600 hover:text-rose-700 font-semibold cursor-pointer flex items-center space-x-1"
            >
              <span>Reset Semua Filter</span>
            </button>
          )}
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
          {/* Filter 1: Komoditas */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Komoditas:</label>
            <select
              value={selectedCommodity}
              onChange={(e) => setSelectedCommodity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Semua Komoditas ({farmers.length})</option>
              {commodityOptions.map((crop) => (
                <option key={crop} value={crop}>
                  {crop}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 2: Wilayah / Kabupaten */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Wilayah / Kabupaten:</label>
            <select
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Semua Wilayah ({regions.length})</option>
              {regions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 3: Periode Panen */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Jadwal Panen:</label>
            <select
              value={selectedHarvestMonth}
              onChange={(e) => setSelectedHarvestMonth(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Semua Periode</option>
              {harvestMonthOptions.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>

          {/* Filter 4: Skala Kepemilikan Lahan */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Skala Lahan:</label>
            <select
              value={selectedScale}
              onChange={(e) => setSelectedScale(e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="all">Semua Skala</option>
              <option value="small">Gurem (&lt; 1.0 Ha)</option>
              <option value="medium">Menengah (1.0 - 2.0 Ha)</option>
              <option value="large">Komersial (&gt; 2.0 Ha)</option>
            </select>
          </div>

          {/* Filter 5: Urutkan Berdasarkan */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Urutkan Berdasarkan:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="yield">Estimasi Hasil (Ton)</option>
              <option value="land">Luas Lahan (Ha)</option>
              <option value="value">Nilai Ekonomi (Rp)</option>
              <option value="harvest">Jadwal Panen</option>
              <option value="name">Nama Petani</option>
            </select>
          </div>

          {/* Filter 6: Arah Pengurutan */}
          <div>
            <label className="font-semibold text-slate-600 block mb-1">Arah Pengurutan:</label>
            <button
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800 font-medium flex items-center justify-between cursor-pointer transition"
            >
              <span>{sortOrder === 'desc' ? 'Tertinggi (Z-A)' : 'Terendah (A-Z)'}</span>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="pt-2 border-t border-slate-100 flex items-center">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari cepat petani berdasarkan nama, desa, varietas benih, atau catatan agronomi..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none placeholder-slate-400"
            />
          </div>
        </div>
      </div>

      {/* 3. Strategic KPI Cards (Dynamic to Filtered Data) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Farmers Demographics */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
            <span>Petani Terfilter</span>
            <div className="p-1 rounded-lg bg-emerald-50 text-emerald-700">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalFilteredFarmers}</div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalFilteredFarmers > 0
              ? `${((filteredFarmers.filter((f) => f.statusVerifikasi === 'Terverifikasi').length / totalFilteredFarmers) * 100).toFixed(0)}% Terverifikasi`
              : '0%'}
          </div>
        </div>

        {/* Card 2: Total Land Usage */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
            <span>Total Penggunaan Lahan</span>
            <div className="p-1 rounded-lg bg-blue-50 text-blue-700">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalFilteredLand.toFixed(1)} Ha</div>
          <div className="text-[11px] text-slate-500 mt-1">
            Rata-rata: {averageLandHolding.toFixed(2)} Ha / petani
          </div>
        </div>

        {/* Card 3: Estimated Harvest Yield */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
            <span>Proyeksi Hasil Panen</span>
            <div className="p-1 rounded-lg bg-amber-50 text-amber-700">
              <Sprout className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 font-mono">{totalFilteredYield.toFixed(1)} Ton</div>
          <div className="text-[11px] text-amber-600 font-medium mt-1">
            Yield Rata-rata: {overallYieldPerHectare.toFixed(2)} Ton/Ha
          </div>
        </div>

        {/* Card 4: Economic Valuation */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
            <span>Valuasi Pasar Berdiri</span>
            <div className="p-1 rounded-lg bg-indigo-50 text-indigo-700">
              <Coins className="w-4 h-4" />
            </div>
          </div>
          <div className="text-xl sm:text-2xl font-black text-indigo-900 font-mono">
            {totalFilteredValuation >= 1_000_000_000
              ? `Rp ${(totalFilteredValuation / 1_000_000_000).toFixed(2)} M`
              : `Rp ${(totalFilteredValuation / 1_000_000).toFixed(1)} Jt`}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Dihitung dari harga spot komoditas
          </div>
        </div>

        {/* Card 5: Anomaly & Risk Watch */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs">
          <div className="flex justify-between items-center text-xs text-slate-500 mb-1">
            <span>Indeks Anomali Pasar</span>
            <div className="p-1 rounded-lg bg-rose-50 text-rose-700">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 font-mono">
            {commodities.filter((c) => c.statusAnomali === 'LONJAKAN_EKSTREM' || c.statusAnomali === 'PENURUNAN_DRASTIS').length}
          </div>
          <div className="text-[11px] text-rose-600 mt-1">
            Perlu intervensi distribusi pangan
          </div>
        </div>
      </div>

      {/* 4. Core Visualizations Grid (Demographics, Land Usage, Crop Distribution, Harvest Timeline) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Viz 1: Land Usage vs Yield Efficiency per Crop (Composed Bar & Line) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
                <BarChart3 className="w-4 h-4 text-emerald-600" />
                <span>Penggunaan Lahan (Ha) & Produktivitas Panen (Ton/Ha)</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Komparasi alokasi lahan terhadap densitas hasil per komoditas
              </p>
            </div>
            <span className="text-[11px] font-mono bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
              Efisiensi Lahan
            </span>
          </div>

          <div className="h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={cropDistribution} margin={{ top: 10, right: 20, left: -10, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="crop" angle={-15} textAnchor="end" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#475569' }} label={{ value: 'Luas Lahan (Ha)', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#059669' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#475569' }} label={{ value: 'Yield (Ton/Ha)', angle: 90, position: 'insideRight', fontSize: 10, fill: '#2563EB' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs shadow-lg space-y-1">
                          <p className="font-bold text-emerald-400">{data.crop}</p>
                          <p>Total Lahan: <strong>{data.lahan} Ha</strong> ({data.shareLahan}%)</p>
                          <p>Total Panen: <strong>{data.panen} Ton</strong></p>
                          <p className="text-blue-300">Produktivitas: <strong>{data.produktivitas} Ton/Ha</strong></p>
                          <p className="text-slate-400">{data.petani} Petani Terdaftar</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="lahan" name="Total Lahan (Ha)" fill="#059669" radius={[6, 6, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="produktivitas" name="Produktivitas (Ton/Ha)" stroke="#2563EB" strokeWidth={3} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Viz 2: Crop Share & Variety Distribution (Pie Chart) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
                <PieIcon className="w-4 h-4 text-indigo-600" />
                <span>Distribusi Komoditas Tanaman</span>
              </h3>
              <p className="text-[11px] text-slate-500">Pangsa persentase alokasi luas lahan</p>
            </div>
            <span className="text-[11px] font-mono bg-indigo-50 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">
              Share Lahan %
            </span>
          </div>

          <div className="h-72 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={cropDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="lahan"
                  nameKey="crop"
                  label={({ crop, shareLahan }) => `${crop.split(' ')[0]} ${shareLahan}%`}
                  labelLine={false}
                >
                  {cropDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(val: any, name: any, item: any) => [
                    `${val} Ha (${item.payload.shareLahan}%)`,
                    item.payload.crop,
                  ]}
                  contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '11px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 5. Demographics & Regional Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Regional Demographics Bar Chart */}
        <div className="lg:col-span-8 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Demografi Spasial Petani & Luas Lahan per Wilayah</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Pemetaan populasi petani dan agregat lahan di sentra produksi
              </p>
            </div>
            <span className="text-[11px] font-mono bg-blue-50 text-blue-800 px-2 py-0.5 rounded-full font-semibold">
              Sentra Wilayah
            </span>
          </div>

          <div className="h-64 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={regionalDemographics} margin={{ top: 10, right: 10, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="region" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#475569' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs space-y-1">
                          <p className="font-bold text-blue-400">{d.region}</p>
                          <p>Jumlah Petani: <strong>{d.petani} orang</strong></p>
                          <p>Luas Lahan: <strong>{d.lahan} Ha</strong></p>
                          <p>Estimasi Panen: <strong>{d.panen} Ton</strong></p>
                          <p className="text-slate-400">Rata-rata: {d.avgLahan} Ha/petani</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px' }} />
                <Bar yAxisId="left" dataKey="lahan" name="Luas Lahan (Ha)" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="petani" name="Jumlah Petani" fill="#0D9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Farmer Scale Demographics Profile */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="pb-2 border-b border-slate-100">
            <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
              <Users className="w-4 h-4 text-emerald-600" />
              <span>Struktur Skala Petani</span>
            </h3>
            <p className="text-[11px] text-slate-500">Segmentasi luas garapan petani terdaftar</p>
          </div>

          <div className="space-y-3 pt-1">
            {scaleDistribution.map((item, idx) => (
              <div key={idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <div className="flex justify-between items-center text-xs mb-1.5">
                  <span className="font-semibold text-slate-800">{item.name}</span>
                  <span className="font-mono font-bold text-slate-900">
                    {item.count} Petani ({item.percent.toFixed(0)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      idx === 0 ? 'bg-amber-500' : idx === 1 ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${Math.max(item.percent, 4)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-snug">
            <span className="font-bold">Catatan Penyuluh (PPL):</span> Petani gurem (&lt; 1 Ha) memerlukan pendampingan mekanisasi kolektif (traktor bersama) dan akses pupuk bersubsidi langsung untuk menekan biaya produksi per hektar.
          </div>
        </div>
      </div>

      {/* 6. Harvest Estimates Timeline & Market Price Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Harvest Timeline (S-Curve & Oversupply Alert) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
                <Calendar className="w-4 h-4 text-amber-600" />
                <span>Timeline Estimasi Panen & Deteksi Risiko Pasokan</span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Proyeksi tonase panen per bulan terhadap batas kapasitas serapan pasar
              </p>
            </div>
            <span className="text-[11px] font-mono bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
              Prediksi Pasokan
            </span>
          </div>

          <div className="h-64 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={harvestTimeline} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 10, fill: '#475569' }} label={{ value: 'Tonase Panen', angle: -90, position: 'insideLeft', fontSize: 10, fill: '#64748B' }} />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const isHigh = d.ton > 25;
                      return (
                        <div className="bg-slate-900 text-white p-2.5 rounded-lg text-xs space-y-1">
                          <p className="font-bold text-amber-400">{d.period}</p>
                          <p>Total Estimasi: <strong>{d.ton} Ton</strong></p>
                          <p>Luas Panen: <strong>{d.ha} Ha</strong> ({d.petani} Petani)</p>
                          {isHigh && (
                            <p className="text-rose-400 font-semibold">
                              ⚠️ Puncak panen terkonsentrasi! Waspada penurunan harga.
                            </p>
                          )}
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend verticalAlign="top" height={32} wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="ton" name="Estimasi Panen (Ton)" fill="#D97706" radius={[6, 6, 0, 0]} />
                <ReferenceLine
                  y={30}
                  stroke="#E11D48"
                  strokeDasharray="4 4"
                  label={{ value: 'Ambang Batas Risiko Oversupply (30 Ton)', position: 'top', fill: '#E11D48', fontSize: 10 }}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Market Price Trends vs Government Benchmark (HAP) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div>
              <h3 className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span>Tren Harga Pasar vs HAP Pemerintah</span>
              </h3>
              <p className="text-[11px] text-slate-500">Benchmark harga spot terhadap Harga Acuan Pembelian</p>
            </div>
            {/* Commodity Selector Dropdown for price trend */}
            <select
              value={activeCommodityForPriceTrend}
              onChange={(e) => setActiveCommodityForPriceTrend(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-slate-800 focus:outline-none"
            >
              {commodities.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nama}
                </option>
              ))}
            </select>
          </div>

          {activeCommodity && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-slate-500 text-[11px] block">Harga Terkini</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    Rp {activeCommodity.hargaSekarang.toLocaleString('id-ID')}/kg
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-500 text-[11px] block">HAP Pemerintah</span>
                  <span className="text-base font-bold text-blue-700 font-mono">
                    Rp {activeCommodity.hargaAcuanPemerintah.toLocaleString('id-ID')}/kg
                  </span>
                </div>
                <div>
                  <span
                    className={`px-2 py-1 rounded-md text-[11px] font-bold ${
                      activeCommodity.statusAnomali === 'LONJAKAN_EKSTREM'
                        ? 'bg-rose-100 text-rose-800'
                        : activeCommodity.statusAnomali === 'PENURUNAN_DRASTIS'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {activeCommodity.perubahanPersen > 0 ? '+' : ''}
                    {activeCommodity.perubahanPersen.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="h-44 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={activeCommodity.tren7Hari} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                    <XAxis dataKey="tanggal" tick={{ fontSize: 10, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#475569' }} domain={['auto', 'auto']} />
                    <Tooltip
                      formatter={(val: any) => [`Rp ${Number(val).toLocaleString('id-ID')}/kg`, 'Harga Spot']}
                      contentStyle={{ backgroundColor: '#0F172A', color: '#fff', borderRadius: '8px', fontSize: '11px' }}
                    />
                    <ReferenceLine
                      y={activeCommodity.hargaAcuanPemerintah}
                      stroke="#2563EB"
                      strokeDasharray="3 3"
                      label={{ value: 'HAP', position: 'insideTopLeft', fill: '#2563EB', fontSize: 10 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="harga"
                      name="Harga Pasar"
                      stroke={activeCommodity.statusAnomali === 'LONJAKAN_EKSTREM' ? '#E11D48' : '#059669'}
                      strokeWidth={2.5}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <p className="text-[11px] text-slate-600 italic bg-emerald-50/60 p-2 rounded-lg border border-emerald-100">
                <strong>Rekomendasi Petani:</strong> {activeCommodity.rekomendasiPetani}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 7. Interactive Master Table (Direct Link to Google Sheets Rows) */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {/* Table Header & Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
              <TableIcon className="w-4 h-4 text-emerald-600" />
              <span>Data Riil Petani Terhubung ke Google Sheets</span>
            </h3>
            <p className="text-xs text-slate-500">
              Menampilkan {sortedAndFilteredFarmers.length} baris spreadsheet terfilter &bull; Diurutkan berdasarkan{' '}
              <span className="font-semibold text-slate-800">
                {sortBy === 'yield'
                  ? 'Hasil Panen (Ton)'
                  : sortBy === 'land'
                  ? 'Luas Lahan (Ha)'
                  : sortBy === 'value'
                  ? 'Nilai Ekonomi'
                  : sortBy === 'harvest'
                  ? 'Jadwal Panen'
                  : 'Nama Petani'}
              </span>{' '}
              ({sortOrder === 'desc' ? 'Menurun' : 'Menaik'})
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={exportToCSV}
              className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Unduh CSV</span>
            </button>
            <button
              onClick={onNavigateToSheets}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Buka Google Sheets</span>
            </button>
          </div>
        </div>

        {/* Scrollable Responsive Data Table */}
        <div className="overflow-x-auto max-h-[440px] scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-100 text-slate-700 uppercase tracking-wider font-semibold sticky top-0 z-10 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3">Row #</th>
                <th className="py-2.5 px-3">Petani & Kontak</th>
                <th className="py-2.5 px-3">Wilayah / Lokasi</th>
                <th className="py-2.5 px-3">Komoditas & Varietas</th>
                <th className="py-2.5 px-3 text-right">Luas Lahan</th>
                <th className="py-2.5 px-3 text-right">Taksiran Panen</th>
                <th className="py-2.5 px-3 text-right">Produktivitas</th>
                <th className="py-2.5 px-3 text-right">Valuasi (Rp)</th>
                <th className="py-2.5 px-3 text-center">Status</th>
                <th className="py-2.5 px-3 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {sortedAndFilteredFarmers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-10 text-center text-slate-400">
                    <Info className="w-6 h-6 mx-auto mb-2 text-slate-300" />
                    Tidak ada data petani yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                sortedAndFilteredFarmers.map((farmer, index) => {
                  const price = getCommodityPrice(farmer.komoditas);
                  const valuation = (farmer.estimasiHasilTon || 0) * 1000 * price;
                  const prod = farmer.luasLahan > 0 ? (farmer.estimasiHasilTon / farmer.luasLahan).toFixed(1) : '0';

                  return (
                    <tr
                      key={farmer.id}
                      className="hover:bg-emerald-50/40 transition duration-150 cursor-pointer"
                      onClick={() => setSelectedFarmerDetail(farmer)}
                    >
                      {/* Row index */}
                      <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                        #{farmer.googleSheetRow || index + 2}
                      </td>

                      {/* Name & WA */}
                      <td className="py-2.5 px-3">
                        <div className="font-bold text-slate-900">{farmer.nama}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{farmer.noHp}</div>
                      </td>

                      {/* Location */}
                      <td className="py-2.5 px-3">
                        <div className="text-slate-800 font-medium">{farmer.kabupaten || 'Lainnya'}</div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[160px]">{farmer.alamat}</div>
                      </td>

                      {/* Crop & Variety */}
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                          {farmer.komoditas}
                        </span>
                        {farmer.varietas && (
                          <span className="text-[11px] text-slate-500 block mt-0.5">
                            Var: {farmer.varietas}
                          </span>
                        )}
                      </td>

                      {/* Land Ha */}
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800">
                        {farmer.luasLahan} Ha
                      </td>

                      {/* Yield Ton & Schedule */}
                      <td className="py-2.5 px-3 text-right">
                        <div className="font-mono font-bold text-amber-700">{farmer.estimasiHasilTon} Ton</div>
                        <div className="text-[10px] text-slate-400">{farmer.estimasiPanen}</div>
                      </td>

                      {/* Productivity Ton/Ha */}
                      <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                        {prod} T/Ha
                      </td>

                      {/* Economic Valuation */}
                      <td className="py-2.5 px-3 text-right font-mono font-semibold text-indigo-700">
                        Rp {valuation.toLocaleString('id-ID')}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                            farmer.statusVerifikasi === 'Terverifikasi'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {farmer.statusVerifikasi === 'Terverifikasi' ? 'Terverifikasi' : 'Menunggu'}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-2.5 px-3 text-center">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedFarmerDetail(farmer);
                          }}
                          className="px-2 py-1 text-[11px] font-medium text-emerald-700 hover:bg-emerald-100 rounded-md transition cursor-pointer"
                        >
                          Catatan
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary Subtotal */}
        <div className="p-3 bg-slate-100 border-t border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600">
          <div className="flex items-center space-x-4">
            <span>
              Total Baris Terfilter: <strong>{sortedAndFilteredFarmers.length} Petani</strong>
            </span>
            <span>
              Total Lahan: <strong>{totalFilteredLand.toFixed(1)} Ha</strong>
            </span>
            <span>
              Total Panen: <strong>{totalFilteredYield.toFixed(1)} Ton</strong>
            </span>
          </div>
          <div className="font-mono font-semibold text-indigo-900">
            Total Nilai Ekonomi Proyeksi: Rp {totalFilteredValuation.toLocaleString('id-ID')}
          </div>
        </div>
      </div>

      {/* Detail Modal for Selected Farmer Agronomic Notes */}
      {selectedFarmerDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full border border-slate-200 p-6 space-y-4 animate-scale-up">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <Sprout className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-900">{selectedFarmerDetail.nama}</h4>
                  <p className="text-[11px] text-slate-500 font-mono">
                    ID: {selectedFarmerDetail.id} &bull; Baris Sheet: #{selectedFarmerDetail.googleSheetRow}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedFarmerDetail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[11px]">Komoditas & Varietas:</span>
                <span className="font-bold text-slate-800">
                  {selectedFarmerDetail.komoditas} ({selectedFarmerDetail.varietas || 'Lokal'})
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[11px]">Luas & Estimasi Panen:</span>
                <span className="font-bold text-slate-800">
                  {selectedFarmerDetail.luasLahan} Ha / {selectedFarmerDetail.estimasiHasilTon} Ton
                </span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[11px]">Wilayah:</span>
                <span className="font-bold text-slate-800">{selectedFarmerDetail.kabupaten || 'Indonesia'}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl">
                <span className="text-slate-400 block text-[11px]">Jadwal Panen:</span>
                <span className="font-bold text-amber-700">{selectedFarmerDetail.estimasiPanen}</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Catatan Agronomi & Validasi AI Lapangan:
              </label>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl text-xs text-emerald-950 leading-relaxed">
                {selectedFarmerDetail.catatanAI || 'Tidak ada catatan agronomi khusus.'}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setSelectedFarmerDetail(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
