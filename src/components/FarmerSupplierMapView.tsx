import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
  ControlPosition,
  MapControl,
} from '@vis.gl/react-google-maps';
import {
  MapPin,
  Sprout,
  Store,
  Layers,
  Filter,
  Search,
  Phone,
  ExternalLink,
  Plus,
  RefreshCw,
  Navigation,
  Compass,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Truck,
  Package,
  Wrench,
  Building2,
  X,
  ChevronRight,
  Maximize2,
  Info,
} from 'lucide-react';
import { FarmerRecord, SupplierRecord } from '../types';

interface FarmerSupplierMapViewProps {
  farmers: FarmerRecord[];
  suppliers: SupplierRecord[];
  onRefreshData?: () => Promise<void>;
  onAddFarmerClick?: () => void;
  onSelectFarmerForChat?: (farmer: FarmerRecord) => void;
  mapsApiKey?: string;
}

// Calculate Haversine distance in kilometers between two geo coordinates
function calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(1));
}

// Center controller helper component using useMap
const MapController: React.FC<{
  selectedLocation: { lat: number; lng: number } | null;
  fitBoundsLocations?: Array<{ lat: number; lng: number }>;
}> = ({ selectedLocation, fitBoundsLocations }) => {
  const map = useMap();

  useEffect(() => {
    if (!map) return;
    if (selectedLocation) {
      map.panTo(selectedLocation);
      map.setZoom(13);
    }
  }, [map, selectedLocation]);

  const fitAll = useCallback(() => {
    if (!map || !fitBoundsLocations || fitBoundsLocations.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    fitBoundsLocations.forEach((loc) => {
      bounds.extend(new google.maps.LatLng(loc.lat, loc.lng));
    });
    map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
  }, [map, fitBoundsLocations]);

  return (
    <div className="absolute bottom-5 right-4 z-10 flex flex-col gap-2">
      <button
        onClick={fitAll}
        className="bg-white/95 hover:bg-white text-slate-800 p-2.5 rounded-xl shadow-lg border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer backdrop-blur-xs hover:border-emerald-500"
        title="Pusatkan peta ke seluruh wilayah sebaran pulau Jawa"
      >
        <Compass className="w-4 h-4 text-emerald-600 animate-spin-slow" />
        <span className="hidden sm:inline">Pusatkan Semua</span>
      </button>
    </div>
  );
};

export const FarmerSupplierMapView: React.FC<FarmerSupplierMapViewProps> = ({
  farmers,
  suppliers,
  onRefreshData,
  onAddFarmerClick,
  onSelectFarmerForChat,
  mapsApiKey: propKey,
}) => {
  // Map API Key resolution with fallback
  const resolvedApiKey =
    propKey ||
    ((import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY as string) ||
    'AIzaSyCfYtODZ0FDfGAjckKotHepIOKryfsr_ZQ';

  // Selection states
  const [selectedFarmer, setSelectedFarmer] = useState<FarmerRecord | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState<SupplierRecord | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'farmers' | 'suppliers' | 'logistics'>('all');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(true);

  // Filter states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [commodityFilter, setCommodityFilter] = useState<string>('all');
  const [supplierCategoryFilter, setSupplierCategoryFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  // Layer Visibility
  const [showFarmersLayer, setShowFarmersLayer] = useState<boolean>(true);
  const [showSuppliersLayer, setShowSuppliersLayer] = useState<boolean>(true);
  const [showCoverageRadius, setShowCoverageRadius] = useState<boolean>(true);
  const [mapTypeId, setMapTypeId] = useState<'roadmap' | 'satellite' | 'hybrid' | 'terrain'>('roadmap');

  // New Marker Modal (Quick Registration)
  const [showRegisterModal, setShowRegisterModal] = useState<boolean>(false);
  const [registerType, setRegisterType] = useState<'petani' | 'supplier'>('petani');
  const [newRegNama, setNewRegNama] = useState<string>('');
  const [newRegAlamat, setNewRegAlamat] = useState<string>('');
  const [newRegKabupaten, setNewRegKabupaten] = useState<string>('Karawang, Jawa Barat');
  const [newRegKomoditas, setNewRegKomoditas] = useState<string>('Padi');
  const [newRegLuas, setNewRegLuas] = useState<string>('1.5');
  const [newRegKategori, setNewRegKategori] = useState<SupplierRecord['kategori']>('Pupuk & Saprodi');
  const [newRegLat, setNewRegLat] = useState<string>('-6.3000');
  const [newRegLng, setNewRegLng] = useState<string>('107.4000');
  const [savingNewPoint, setSavingNewPoint] = useState<boolean>(false);

  // Region options
  const availableRegions = useMemo(() => {
    const set = new Set<string>();
    farmers.forEach((f) => {
      if (f.kabupaten) set.add(f.kabupaten.split(',')[0].trim());
    });
    suppliers.forEach((s) => {
      if (s.kabupaten) set.add(s.kabupaten.split(',')[0].trim());
    });
    return Array.from(set);
  }, [farmers, suppliers]);

  // Filtered Farmers
  const filteredFarmers = useMemo(() => {
    return farmers.filter((f) => {
      if (!showFarmersLayer) return false;
      const matchSearch =
        searchQuery === '' ||
        f.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.alamat.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (f.kabupaten && f.kabupaten.toLowerCase().includes(searchQuery.toLowerCase())) ||
        f.komoditas.toLowerCase().includes(searchQuery.toLowerCase());

      const matchCommodity =
        commodityFilter === 'all' || f.komoditas.toLowerCase().includes(commodityFilter.toLowerCase());

      const matchRegion =
        regionFilter === 'all' ||
        (f.kabupaten && f.kabupaten.toLowerCase().includes(regionFilter.toLowerCase()));

      return matchSearch && matchCommodity && matchRegion;
    });
  }, [farmers, showFarmersLayer, searchQuery, commodityFilter, regionFilter]);

  // Filtered Suppliers
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (!showSuppliersLayer) return false;
      const matchSearch =
        searchQuery === '' ||
        s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.alamat.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.kabupaten.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.produkUnggulan.some((p) => p.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchCategory =
        supplierCategoryFilter === 'all' || s.kategori === supplierCategoryFilter;

      const matchRegion =
        regionFilter === 'all' || s.kabupaten.toLowerCase().includes(regionFilter.toLowerCase());

      return matchSearch && matchCategory && matchRegion;
    });
  }, [suppliers, showSuppliersLayer, searchQuery, supplierCategoryFilter, regionFilter]);

  // Locations for fitting bounds
  const fitLocations = useMemo(() => {
    const list: Array<{ lat: number; lng: number }> = [];
    filteredFarmers.forEach((f) => {
      if (f.latitude && f.longitude) list.push({ lat: f.latitude, lng: f.longitude });
    });
    filteredSuppliers.forEach((s) => {
      if (s.latitude && s.longitude) list.push({ lat: s.latitude, lng: s.longitude });
    });
    return list;
  }, [filteredFarmers, filteredSuppliers]);

  // Current selected target location for auto-pan
  const selectedTargetLocation = useMemo(() => {
    if (selectedFarmer && selectedFarmer.latitude && selectedFarmer.longitude) {
      return { lat: selectedFarmer.latitude, lng: selectedFarmer.longitude };
    }
    if (selectedSupplier && selectedSupplier.latitude && selectedSupplier.longitude) {
      return { lat: selectedSupplier.latitude, lng: selectedSupplier.longitude };
    }
    return null;
  }, [selectedFarmer, selectedSupplier]);

  // Nearest suppliers to selected farmer
  const nearestSuppliersToFarmer = useMemo(() => {
    if (!selectedFarmer || !selectedFarmer.latitude || !selectedFarmer.longitude) return [];
    return suppliers
      .map((s) => {
        const dist = calculateDistanceKm(
          selectedFarmer.latitude!,
          selectedFarmer.longitude!,
          s.latitude,
          s.longitude
        );
        return { supplier: s, distanceKm: dist };
      })
      .sort((a, b) => a.distanceKm - b.distanceKm);
  }, [selectedFarmer, suppliers]);

  // Submit new marker to backend
  const handleSaveNewPoint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRegNama || !newRegLat || !newRegLng) return;
    setSavingNewPoint(true);
    try {
      if (registerType === 'petani') {
        const payload = {
          nama: newRegNama,
          alamat: newRegAlamat || 'Desa Binaan Baru',
          kabupaten: newRegKabupaten,
          komoditas: newRegKomoditas,
          luasLahan: parseFloat(newRegLuas) || 1.0,
          latitude: parseFloat(newRegLat),
          longitude: parseFloat(newRegLng),
        };
        await fetch('/api/farmers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        const payload = {
          nama: newRegNama,
          alamat: newRegAlamat || 'Pusat Distribusi Saprodi',
          kabupaten: newRegKabupaten,
          kategori: newRegKategori,
          latitude: parseFloat(newRegLat),
          longitude: parseFloat(newRegLng),
        };
        await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (onRefreshData) {
        await onRefreshData();
      }
      setShowRegisterModal(false);
      setNewRegNama('');
      setNewRegAlamat('');
    } catch (err) {
      console.error('Error saving new point:', err);
    } finally {
      setSavingNewPoint(false);
    }
  };

  // Helper for commodity color
  const getCommodityBadge = (komoditas: string) => {
    const lower = komoditas.toLowerCase();
    if (lower.includes('padi')) {
      return { icon: '🌾', bg: 'bg-emerald-600', text: 'text-emerald-100', border: 'border-emerald-400', label: 'Padi' };
    }
    if (lower.includes('cabai') || lower.includes('cabe')) {
      return { icon: '🌶️', bg: 'bg-rose-600', text: 'text-rose-100', border: 'border-rose-400', label: 'Cabai' };
    }
    if (lower.includes('bawang')) {
      return { icon: '🧅', bg: 'bg-purple-600', text: 'text-purple-100', border: 'border-purple-400', label: 'Bawang' };
    }
    if (lower.includes('jagung')) {
      return { icon: '🌽', bg: 'bg-amber-600', text: 'text-amber-100', border: 'border-amber-400', label: 'Jagung' };
    }
    return { icon: '🌱', bg: 'bg-teal-600', text: 'text-teal-100', border: 'border-teal-400', label: komoditas };
  };

  // Helper for supplier category styling
  const getSupplierStyle = (kategori: SupplierRecord['kategori']) => {
    switch (kategori) {
      case 'Pupuk & Saprodi':
        return { icon: '📦', color: '#0284c7', bg: 'bg-sky-600', badge: 'bg-sky-100 text-sky-800' };
      case 'Bibit & Benih':
        return { icon: '🌱', color: '#16a34a', bg: 'bg-green-600', badge: 'bg-green-100 text-green-800' };
      case 'Alat & Mesin Pertanian (Alsintan)':
        return { icon: '🚜', color: '#ea580c', bg: 'bg-orange-600', badge: 'bg-orange-100 text-orange-800' };
      case 'Offtaker & Pengepul':
        return { icon: '🏢', color: '#7c3aed', bg: 'bg-purple-600', badge: 'bg-purple-100 text-purple-800' };
      case 'Koperasi Tani':
        return { icon: '🤝', color: '#0d9488', bg: 'bg-teal-600', badge: 'bg-teal-100 text-teal-800' };
      default:
        return { icon: '🏪', color: '#475569', bg: 'bg-slate-600', badge: 'bg-slate-100 text-slate-800' };
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] w-full overflow-hidden bg-slate-900 text-slate-100">
      {/* Top Bar Filter & Statistic Ribbon */}
      <div className="bg-slate-800/90 border-b border-slate-700/80 px-4 py-3 shrink-0 backdrop-blur-md z-30">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Title & Quick Stats */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center shadow-md shadow-emerald-700/30">
              <MapPin className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base font-bold text-white tracking-tight">
                  Peta Sebaran Spasial Petani & Supplier
                </h1>
                <span className="bg-emerald-500/20 text-emerald-400 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Google Maps Live
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Visualisasi titik koordinat lahan tani, kios saprodi pupuk/benih, dan offtaker terhubung di Pulau Jawa
              </p>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="flex items-center gap-2 sm:gap-3 text-xs">
            <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Sprout className="w-4 h-4 text-emerald-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">Petani Terdata</span>
                <span className="font-bold text-white text-xs">{filteredFarmers.length} Lokasi</span>
              </div>
            </div>

            <div className="bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <Store className="w-4 h-4 text-sky-400" />
              <div>
                <span className="text-slate-400 block text-[10px]">Supplier Mitra</span>
                <span className="font-bold text-white text-xs">{filteredSuppliers.length} Kios/Hub</span>
              </div>
            </div>

            <button
              onClick={() => setShowRegisterModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition cursor-pointer shadow-sm text-xs"
              title="Daftarkan Petani atau Kios Supplier Baru ke Titik Koordinat Peta"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tambah Titik Koordinat</span>
            </button>
          </div>
        </div>

        {/* Filter and Layer Controls Row */}
        <div className="max-w-7xl mx-auto mt-2.5 pt-2.5 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-2 text-xs">
          {/* Search and Filters */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            {/* Search Input */}
            <div className="relative min-w-[180px] sm:min-w-[220px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari petani, desa, atau supplier..."
                className="w-full bg-slate-900/90 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Commodity Filter */}
            <select
              value={commodityFilter}
              onChange={(e) => setCommodityFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="all">🌾 Semua Komoditas</option>
              <option value="padi">Padi</option>
              <option value="cabai">Cabai</option>
              <option value="bawang">Bawang Merah</option>
              <option value="jagung">Jagung</option>
            </select>

            {/* Supplier Category Filter */}
            <select
              value={supplierCategoryFilter}
              onChange={(e) => setSupplierCategoryFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="all">🏪 Semua Kategori Supplier</option>
              <option value="Pupuk & Saprodi">📦 Pupuk & Saprodi</option>
              <option value="Bibit & Benih">🌱 Bibit & Benih</option>
              <option value="Alat & Mesin Pertanian (Alsintan)">🚜 Alsintan & Pompanisasi</option>
              <option value="Offtaker & Pengepul">🏢 Offtaker & Pengepul</option>
              <option value="Koperasi Tani">🤝 Koperasi Tani</option>
            </select>

            {/* Region Filter */}
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:border-emerald-500"
            >
              <option value="all">📍 Semua Wilayah</option>
              {availableRegions.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          {/* Layer toggles and Map Style */}
          <div className="flex items-center gap-2">
            {/* Layer Petani Toggle */}
            <button
              onClick={() => setShowFarmersLayer(!showFarmersLayer)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                showFarmersLayer
                  ? 'bg-emerald-950/80 border-emerald-600 text-emerald-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showFarmersLayer ? 'bg-emerald-400' : 'bg-slate-500'}`} />
              <span>Layer Petani</span>
            </button>

            {/* Layer Supplier Toggle */}
            <button
              onClick={() => setShowSuppliersLayer(!showSuppliersLayer)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition cursor-pointer ${
                showSuppliersLayer
                  ? 'bg-sky-950/80 border-sky-600 text-sky-300'
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${showSuppliersLayer ? 'bg-sky-400' : 'bg-slate-500'}`} />
              <span>Layer Supplier</span>
            </button>

            {/* Map Type Buttons */}
            <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setMapTypeId('roadmap')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  mapTypeId === 'roadmap' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Peta
              </button>
              <button
                onClick={() => setMapTypeId('hybrid')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  mapTypeId === 'hybrid' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Satelit
              </button>
              <button
                onClick={() => setMapTypeId('terrain')}
                className={`px-2 py-0.5 rounded text-[11px] font-medium transition cursor-pointer ${
                  mapTypeId === 'terrain' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Topografi
              </button>
            </div>

            {/* Toggle Sidebar */}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-1.5 rounded-lg border text-xs transition cursor-pointer ${
                sidebarOpen ? 'bg-slate-700 border-slate-600 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}
              title="Buka/Tutup Panel Daftar Titik & Analisis Rantai Pasok"
            >
              <Layers className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Map + Sidebar Workspace */}
      <div className="flex-1 relative flex overflow-hidden">
        {/* Map View Port */}
        <div className="flex-1 h-full w-full relative">
          <APIProvider
            apiKey={resolvedApiKey}
            internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
          >
            <Map
              defaultCenter={{ lat: -7.1, lng: 110.2 }}
              defaultZoom={7.8}
              mapId="tani_ai_interactive_map"
              mapTypeId={mapTypeId}
              gestureHandling="greedy"
              disableDefaultUI={false}
              className="w-full h-full"
            >
              {/* Center & Bounds Map Controller */}
              <MapController
                selectedLocation={selectedTargetLocation}
                fitBoundsLocations={fitLocations}
              />

              {/* Farmer Advanced Markers */}
              {showFarmersLayer &&
                filteredFarmers.map((f) => {
                  if (!f.latitude || !f.longitude) return null;
                  const isSelected = selectedFarmer?.id === f.id;
                  const badge = getCommodityBadge(f.komoditas);

                  return (
                    <AdvancedMarker
                      key={f.id}
                      position={{ lat: f.latitude, lng: f.longitude }}
                      onClick={() => {
                        setSelectedFarmer(f);
                        setSelectedSupplier(null);
                      }}
                      title={`${f.nama} (${f.komoditas}) - ${f.kabupaten}`}
                    >
                      <div
                        className={`group relative flex items-center justify-center transition-transform cursor-pointer ${
                          isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-10'
                        }`}
                      >
                        {/* Custom Farmer Pin Badge */}
                        <div
                          className={`w-9 h-9 rounded-full ${badge.bg} text-white flex items-center justify-center shadow-lg border-2 ${
                            isSelected ? 'border-white ring-4 ring-emerald-400/50' : 'border-slate-800'
                          }`}
                        >
                          <span className="text-sm select-none">{badge.icon}</span>
                        </div>

                        {/* Floating label on hover or when selected */}
                        {(isSelected || false) && (
                          <div className="absolute -bottom-6 bg-slate-900/95 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md border border-slate-700 whitespace-nowrap z-20 pointer-events-none">
                            {f.nama} ({f.luasLahan} Ha)
                          </div>
                        )}
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* Supplier Advanced Markers */}
              {showSuppliersLayer &&
                filteredSuppliers.map((s) => {
                  const isSelected = selectedSupplier?.id === s.id;
                  const style = getSupplierStyle(s.kategori);

                  return (
                    <AdvancedMarker
                      key={s.id}
                      position={{ lat: s.latitude, lng: s.longitude }}
                      onClick={() => {
                        setSelectedSupplier(s);
                        setSelectedFarmer(null);
                      }}
                      title={`${s.nama} [${s.kategori}]`}
                    >
                      <div
                        className={`group relative flex items-center justify-center transition-transform cursor-pointer ${
                          isSelected ? 'scale-125 z-30' : 'hover:scale-110 z-20'
                        }`}
                      >
                        {/* Supplier Pin Badge */}
                        <div
                          className={`w-9 h-9 rounded-xl ${style.bg} text-white flex items-center justify-center shadow-lg border-2 ${
                            isSelected ? 'border-amber-300 ring-4 ring-sky-400/50' : 'border-slate-900'
                          }`}
                        >
                          <span className="text-sm select-none">{style.icon}</span>
                        </div>

                        {/* Floating Label */}
                        {isSelected && (
                          <div className="absolute -bottom-6 bg-slate-900/95 text-sky-200 text-[10px] font-bold px-2 py-0.5 rounded shadow-md border border-sky-600/60 whitespace-nowrap z-20 pointer-events-none">
                            {s.nama}
                          </div>
                        )}
                      </div>
                    </AdvancedMarker>
                  );
                })}

              {/* InfoWindow for Selected Farmer */}
              {selectedFarmer && selectedFarmer.latitude && selectedFarmer.longitude && (
                <InfoWindow
                  position={{ lat: selectedFarmer.latitude, lng: selectedFarmer.longitude }}
                  onCloseClick={() => setSelectedFarmer(null)}
                  maxWidth={320}
                >
                  <div className="p-1 text-slate-800 font-sans text-xs">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2 mb-2">
                      <div>
                        <span className="text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded">
                          {selectedFarmer.id}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm mt-1">{selectedFarmer.nama}</h3>
                        <p className="text-[11px] text-slate-500">{selectedFarmer.alamat}, {selectedFarmer.kabupaten}</p>
                      </div>
                      <span className="text-xl">{getCommodityBadge(selectedFarmer.komoditas).icon}</span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Komoditas:</span>
                        <span className="font-semibold text-emerald-800">
                          {selectedFarmer.komoditas} {selectedFarmer.varietas ? `(${selectedFarmer.varietas})` : ''}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Luas Lahan:</span>
                        <span className="font-mono font-bold text-slate-900">{selectedFarmer.luasLahanFormatted}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Estimasi Panen:</span>
                        <span className="font-medium text-amber-700">{selectedFarmer.estimasiPanen} (~{selectedFarmer.estimasiHasilTon} Ton)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status:</span>
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.2 rounded text-[10px]">
                          {selectedFarmer.statusVerifikasi}
                        </span>
                      </div>
                    </div>

                    {/* AI Field Note */}
                    {selectedFarmer.catatanAI && (
                      <div className="mt-2 bg-emerald-50 border border-emerald-200 rounded p-1.5 text-[10px] text-emerald-900">
                        <p className="font-semibold">💡 Rekomendasi Agronomi:</p>
                        <p className="italic text-emerald-800 line-clamp-2">{selectedFarmer.catatanAI}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between gap-1.5">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedFarmer.latitude},${selectedFarmer.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-center py-1 rounded font-medium text-[11px] flex items-center justify-center gap-1"
                      >
                        <Navigation className="w-3 h-3 text-slate-500" />
                        <span>Rute</span>
                      </a>

                      <a
                        href={`https://wa.me/${selectedFarmer.noHp.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-center py-1 rounded font-medium text-[11px] flex items-center justify-center gap-1 shadow-xs"
                      >
                        <Phone className="w-3 h-3" />
                        <span>WhatsApp</span>
                      </a>
                    </div>
                  </div>
                </InfoWindow>
              )}

              {/* InfoWindow for Selected Supplier */}
              {selectedSupplier && (
                <InfoWindow
                  position={{ lat: selectedSupplier.latitude, lng: selectedSupplier.longitude }}
                  onCloseClick={() => setSelectedSupplier(null)}
                  maxWidth={320}
                >
                  <div className="p-1 text-slate-800 font-sans text-xs">
                    <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2 mb-2">
                      <div>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${getSupplierStyle(selectedSupplier.kategori).badge}`}>
                          {selectedSupplier.kategori}
                        </span>
                        <h3 className="font-bold text-slate-900 text-sm mt-1">{selectedSupplier.nama}</h3>
                        <p className="text-[11px] text-slate-500">{selectedSupplier.alamat}, {selectedSupplier.kabupaten}</p>
                      </div>
                      <span className="text-xl">{getSupplierStyle(selectedSupplier.kategori).icon}</span>
                    </div>

                    <div className="space-y-1.5 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status Kemitraan:</span>
                        <span className="font-semibold text-sky-800 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200">
                          {selectedSupplier.statusKemitraan}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Radius Layanan:</span>
                        <span className="font-mono font-bold text-slate-900">~{selectedSupplier.radiusLayananKm || 25} km</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Petani Terhubung:</span>
                        <span className="font-semibold text-emerald-700">{selectedSupplier.petaniBinaanCount || 30}+ Petani Binaan</span>
                      </div>
                      {selectedSupplier.jamBuka && (
                        <div className="flex justify-between">
                          <span className="text-slate-500">Jam Operasional:</span>
                          <span className="text-slate-700 text-[10px]">{selectedSupplier.jamBuka}</span>
                        </div>
                      )}
                    </div>

                    {/* Produk Unggulan */}
                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded p-1.5 text-[10px]">
                      <p className="font-semibold text-slate-700">Produk / Layanan Unggulan:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {selectedSupplier.produkUnggulan.map((p, i) => (
                          <span key={i} className="bg-white border border-slate-300 text-slate-700 px-1.5 py-0.2 rounded text-[9px]">
                            {p}
                          </span>
                        ))}
                      </div>
                      {selectedSupplier.stokTersedia && (
                        <p className="mt-1 text-emerald-700 font-medium">✓ {selectedSupplier.stokTersedia}</p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="mt-3 pt-2 border-t border-slate-200 flex items-center justify-between gap-1.5">
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${selectedSupplier.latitude},${selectedSupplier.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-center py-1 rounded font-medium text-[11px] flex items-center justify-center gap-1"
                      >
                        <Navigation className="w-3 h-3 text-slate-500" />
                        <span>Rute</span>
                      </a>

                      <a
                        href={`https://wa.me/${selectedSupplier.kontak.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="flex-1 bg-sky-600 hover:bg-sky-700 text-white text-center py-1 rounded font-medium text-[11px] flex items-center justify-center gap-1 shadow-xs"
                      >
                        <Phone className="w-3 h-3" />
                        <span>Hubungi Kios</span>
                      </a>
                    </div>
                  </div>
                </InfoWindow>
              )}
            </Map>
          </APIProvider>

          {/* Map Legend Overlay in bottom-left */}
          <div className="absolute bottom-4 left-4 z-10 bg-slate-900/90 border border-slate-700 p-2.5 rounded-xl shadow-xl backdrop-blur-md text-[11px] max-w-[260px] hidden sm:block">
            <h4 className="font-bold text-white text-xs mb-1.5 flex items-center gap-1.5">
              <span>Legenda Simbol Spasial</span>
            </h4>
            <div className="space-y-1 text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-600 border border-white" />
                <span>Petani Komoditas (Padi, Cabai, dll)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-sky-600 border border-white" />
                <span>Kios Pupuk & Saprodi Resmi BUMN</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-orange-600 border border-white" />
                <span>Alsintan, Traktor & Pompanisasi</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded bg-purple-600 border border-white" />
                <span>Offtaker & Gudang Serap Panen</span>
              </div>
            </div>
          </div>
        </div>

        {/* Collapsible Sidebar: Lists, Details & Supply Chain Insights */}
        {sidebarOpen && (
          <aside className="w-80 sm:w-96 bg-slate-900 border-l border-slate-800 flex flex-col h-full z-20 shadow-2xl transition-all">
            {/* Sidebar Header & Tabs */}
            <div className="p-3 border-b border-slate-800 bg-slate-950/70 shrink-0">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-white text-xs flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Eksplorasi Jaringan Tani & Rantai Pasok
                </span>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Sub-Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-slate-800/80 p-1 rounded-lg text-xs">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`py-1 rounded font-medium transition cursor-pointer text-center ${
                    activeTab === 'all' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Semua ({filteredFarmers.length + filteredSuppliers.length})
                </button>
                <button
                  onClick={() => setActiveTab('farmers')}
                  className={`py-1 rounded font-medium transition cursor-pointer text-center ${
                    activeTab === 'farmers' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Petani ({filteredFarmers.length})
                </button>
                <button
                  onClick={() => setActiveTab('suppliers')}
                  className={`py-1 rounded font-medium transition cursor-pointer text-center ${
                    activeTab === 'suppliers' ? 'bg-emerald-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Supplier ({filteredSuppliers.length})
                </button>
              </div>
            </div>

            {/* Selected Item Detail Panel if any */}
            {(selectedFarmer || selectedSupplier) && (
              <div className="p-3 bg-slate-800/70 border-b border-slate-700 shrink-0">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">
                    {selectedFarmer ? 'Titik Petani Terpilih' : 'Titik Supplier Terpilih'}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedFarmer(null);
                      setSelectedSupplier(null);
                    }}
                    className="text-slate-400 hover:text-white text-xs underline"
                  >
                    Tutup Detail
                  </button>
                </div>

                {selectedFarmer && (
                  <div className="bg-slate-900/90 border border-emerald-500/40 rounded-xl p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-white text-sm">{selectedFarmer.nama}</h4>
                        <p className="text-xs text-slate-400">{selectedFarmer.alamat}, {selectedFarmer.kabupaten}</p>
                      </div>
                      <span className="text-xl">{getCommodityBadge(selectedFarmer.komoditas).icon}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-800 text-[11px]">
                      <div>
                        <span className="text-slate-400 block">Lahan & Panen:</span>
                        <span className="font-bold text-emerald-400">{selectedFarmer.luasLahanFormatted}</span>
                        <span className="text-slate-300 block">~{selectedFarmer.estimasiHasilTon} Ton ({selectedFarmer.estimasiPanen})</span>
                      </div>
                      <div>
                        <span className="text-slate-400 block">Nomor WhatsApp:</span>
                        <span className="font-mono text-white">{selectedFarmer.noHp}</span>
                        <span className="text-emerald-400 block font-semibold text-[10px]">{selectedFarmer.statusVerifikasi}</span>
                      </div>
                    </div>

                    {/* Nearest Suppliers to this farmer */}
                    <div className="mt-3 pt-2 border-t border-slate-800">
                      <p className="text-[11px] font-bold text-sky-400 mb-1 flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5" />
                        <span>Kemitraan Kios Terdekat:</span>
                      </p>
                      <div className="space-y-1">
                        {nearestSuppliersToFarmer.slice(0, 2).map(({ supplier: ns, distanceKm }) => (
                          <div
                            key={ns.id}
                            onClick={() => {
                              setSelectedSupplier(ns);
                              setSelectedFarmer(null);
                            }}
                            className="bg-slate-800/90 hover:bg-slate-750 p-2 rounded-lg border border-slate-700 flex items-center justify-between text-[11px] cursor-pointer transition"
                          >
                            <div>
                              <p className="font-semibold text-white truncate max-w-[170px]">{ns.nama}</p>
                              <p className="text-slate-400 text-[10px]">{ns.kategori}</p>
                            </div>
                            <span className="bg-sky-950 text-sky-300 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]">
                              {distanceKm} km
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {selectedSupplier && (
                  <div className="bg-slate-900/90 border border-sky-500/40 rounded-xl p-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="bg-sky-500/20 text-sky-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-sky-500/30">
                          {selectedSupplier.kategori}
                        </span>
                        <h4 className="font-bold text-white text-sm mt-1">{selectedSupplier.nama}</h4>
                        <p className="text-xs text-slate-400">{selectedSupplier.alamat}, {selectedSupplier.kabupaten}</p>
                      </div>
                      <span className="text-xl">{getSupplierStyle(selectedSupplier.kategori).icon}</span>
                    </div>

                    <div className="mt-2 pt-2 border-t border-slate-800 text-[11px] space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Kontak:</span>
                        <span className="font-mono text-white">{selectedSupplier.kontak}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Status Kemitraan:</span>
                        <span className="text-sky-300 font-medium">{selectedSupplier.statusKemitraan}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Radius Layanan:</span>
                        <span className="text-white font-mono">{selectedSupplier.radiusLayananKm} km</span>
                      </div>
                    </div>

                    <div className="mt-2 bg-slate-800/80 p-2 rounded-lg text-[10px]">
                      <p className="text-emerald-400 font-medium">✓ {selectedSupplier.stokTersedia}</p>
                      <p className="text-slate-400 mt-1">
                        Menyalurkan pasokan ke <strong>{selectedSupplier.petaniBinaanCount || 30}+ petani</strong> di sekitarnya.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* List of Entities */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {/* Petani List Items */}
              {(activeTab === 'all' || activeTab === 'farmers') && (
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1 mb-1.5">
                    <span>Daftar Petani ({filteredFarmers.length})</span>
                    <span className="text-[10px] text-emerald-400">Klik untuk zoom peta</span>
                  </div>

                  <div className="space-y-1.5">
                    {filteredFarmers.map((f) => {
                      const isSel = selectedFarmer?.id === f.id;
                      const badge = getCommodityBadge(f.komoditas);

                      return (
                        <div
                          key={f.id}
                          onClick={() => {
                            setSelectedFarmer(f);
                            setSelectedSupplier(null);
                          }}
                          className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            isSel
                              ? 'bg-emerald-950/70 border-emerald-500 text-white shadow-md'
                              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg ${badge.bg} text-white flex items-center justify-center shrink-0 text-sm`}>
                              {badge.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs truncate text-white">{f.nama}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {f.komoditas} &bull; {f.luasLahanFormatted} &bull; {f.kabupaten}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 shrink-0 ${isSel ? 'text-emerald-400' : 'text-slate-500'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Supplier List Items */}
              {(activeTab === 'all' || activeTab === 'suppliers') && (
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-400 px-1 mb-1.5">
                    <span>Daftar Supplier ({filteredSuppliers.length})</span>
                    <span className="text-[10px] text-sky-400">Kios & Offtaker</span>
                  </div>

                  <div className="space-y-1.5">
                    {filteredSuppliers.map((s) => {
                      const isSel = selectedSupplier?.id === s.id;
                      const style = getSupplierStyle(s.kategori);

                      return (
                        <div
                          key={s.id}
                          onClick={() => {
                            setSelectedSupplier(s);
                            setSelectedFarmer(null);
                          }}
                          className={`p-2.5 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                            isSel
                              ? 'bg-sky-950/70 border-sky-500 text-white shadow-md'
                              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 text-slate-200'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5 min-w-0">
                            <div className={`w-8 h-8 rounded-lg ${style.bg} text-white flex items-center justify-center shrink-0 text-sm`}>
                              {style.icon}
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs truncate text-white">{s.nama}</p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {s.kategori} &bull; {s.kabupaten}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className={`w-4 h-4 shrink-0 ${isSel ? 'text-sky-400' : 'text-slate-500'}`} />
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modal: Tambah Titik Baru (Petani / Supplier) */}
      {showRegisterModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-5 shadow-2xl text-slate-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                  <MapPin className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Tambah Titik Koordinat Baru</h3>
                  <p className="text-xs text-slate-400">Plot data spasial petani atau supplier ke Google Maps</p>
                </div>
              </div>
              <button
                onClick={() => setShowRegisterModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNewPoint} className="space-y-3 text-xs">
              {/* Type selection */}
              <div className="grid grid-cols-2 gap-2 bg-slate-800 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setRegisterType('petani')}
                  className={`py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                    registerType === 'petani' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                  }`}
                >
                  🌾 Petani / Lahan Tani
                </button>
                <button
                  type="button"
                  onClick={() => setRegisterType('supplier')}
                  className={`py-1.5 rounded-lg font-bold text-xs transition cursor-pointer ${
                    registerType === 'supplier' ? 'bg-sky-600 text-white' : 'text-slate-400'
                  }`}
                >
                  🏪 Supplier / Kios Saprodi
                </button>
              </div>

              {/* Name */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  {registerType === 'petani' ? 'Nama Lengkap Petani' : 'Nama Toko / Kios / Offtaker'}
                </label>
                <input
                  type="text"
                  required
                  value={newRegNama}
                  onChange={(e) => setNewRegNama(e.target.value)}
                  placeholder={registerType === 'petani' ? 'contoh: Pak H. Ridwan Kamil' : 'contoh: KPL Tani Makmur Sentosa'}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                />
              </div>

              {/* Specific fields */}
              {registerType === 'petani' ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Komoditas</label>
                    <select
                      value={newRegKomoditas}
                      onChange={(e) => setNewRegKomoditas(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                    >
                      <option value="Padi">Padi</option>
                      <option value="Cabai Rawit Merah">Cabai Rawit Merah</option>
                      <option value="Cabai Merah Keriting">Cabai Merah Keriting</option>
                      <option value="Bawang Merah">Bawang Merah</option>
                      <option value="Jagung">Jagung Hibrida</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 font-semibold mb-1">Luas Lahan (Ha)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={newRegLuas}
                      onChange={(e) => setNewRegLuas(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Kategori Supplier</label>
                  <select
                    value={newRegKategori}
                    onChange={(e) => setNewRegKategori(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-2 text-white focus:outline-none focus:border-emerald-500 text-xs"
                  >
                    <option value="Pupuk & Saprodi">📦 Pupuk & Saprodi Resmi BUMN</option>
                    <option value="Bibit & Benih">🌱 Bibit & Benih Unggul Bersertifikat</option>
                    <option value="Alat & Mesin Pertanian (Alsintan)">🚜 Alat & Mesin Pertanian (Alsintan)</option>
                    <option value="Offtaker & Pengepul">🏢 Offtaker & Pengepul Hasil Panen</option>
                    <option value="Koperasi Tani">🤝 Koperasi Tani Terpadu</option>
                  </select>
                </div>
              )}

              {/* Address & District */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Alamat / Desa</label>
                  <input
                    type="text"
                    value={newRegAlamat}
                    onChange={(e) => setNewRegAlamat(e.target.value)}
                    placeholder="Desa Sukamaju, Kec. Ciasem"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Kabupaten, Provinsi</label>
                  <input
                    type="text"
                    value={newRegKabupaten}
                    onChange={(e) => setNewRegKabupaten(e.target.value)}
                    placeholder="Subang, Jawa Barat"
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 text-xs"
                  />
                </div>
              </div>

              {/* Coordinates (Latitude & Longitude) */}
              <div className="grid grid-cols-2 gap-3 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-slate-400 font-mono text-[11px] mb-1">Latitude (Garis Lintang)</label>
                  <input
                    type="text"
                    required
                    value={newRegLat}
                    onChange={(e) => setNewRegLat(e.target.value)}
                    placeholder="-6.3000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white text-xs"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-mono text-[11px] mb-1">Longitude (Garis Bujur)</label>
                  <input
                    type="text"
                    required
                    value={newRegLng}
                    onChange={(e) => setNewRegLng(e.target.value)}
                    placeholder="107.4000"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white text-xs"
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowRegisterModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-750 font-medium text-xs transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingNewPoint}
                  className="px-4 py-2 rounded-xl text-white bg-emerald-600 hover:bg-emerald-500 font-bold text-xs transition cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingNewPoint ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Simpan Titik ke Peta</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
