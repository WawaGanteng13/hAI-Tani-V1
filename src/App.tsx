import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { AgriProfessionalDashboard } from './components/AgriProfessionalDashboard';
import { WhatsAppChatbot } from './components/WhatsAppChatbot';
import { GoogleSheetsView } from './components/GoogleSheetsView';
import { MarketAnomalyView } from './components/MarketAnomalyView';
import { DataScientistPortal } from './components/DataScientistPortal';
import { FarmerSupplierMapView } from './components/FarmerSupplierMapView';
import { WebhookModal } from './components/WebhookModal';
import { AddFarmerModal } from './components/AddFarmerModal';
import { AddSupplierModal } from './components/AddSupplierModal';
import { AdminManagerModal } from './components/AdminManagerModal';
import { NineRouterModal } from './components/NineRouterModal';
import { TechnicalWhitepaperModal } from './components/TechnicalWhitepaperModal';
import { FarmerRecord, MarketCommodity, AnomalyNotification, StrategicRecommendation, AdminUser, NineRouterStatus, SupplierRecord } from './types';
import {
  INITIAL_FARMERS,
  INITIAL_COMMODITIES,
  INITIAL_NOTIFICATIONS,
  INITIAL_STRATEGIC_RECOMMENDATION,
  INITIAL_ADMINS,
  INITIAL_SUPPLIERS,
} from './data/mockData';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'chat' | 'sheets' | 'market' | 'datascientist' | 'map'>('dashboard');
  const [farmers, setFarmers] = useState<FarmerRecord[]>(INITIAL_FARMERS);
  const [commodities, setCommodities] = useState<MarketCommodity[]>(INITIAL_COMMODITIES);
  const [notifications, setNotifications] = useState<AnomalyNotification[]>(INITIAL_NOTIFICATIONS);
  const [recommendation, setRecommendation] = useState<StrategicRecommendation>(INITIAL_STRATEGIC_RECOMMENDATION);
  const [admins, setAdmins] = useState<AdminUser[]>(INITIAL_ADMINS);
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>(INITIAL_SUPPLIERS);

  const [loading, setLoading] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const [isAddFarmerModalOpen, setIsAddFarmerModalOpen] = useState(false);
  const [isAddSupplierModalOpen, setIsAddSupplierModalOpen] = useState(false);
  const [isAdminManagerOpen, setIsAdminManagerOpen] = useState(false);
  const [isNineRouterModalOpen, setIsNineRouterModalOpen] = useState(false);
  const [isWhitepaperModalOpen, setIsWhitepaperModalOpen] = useState(false);
  const [nineRouterStatus, setNineRouterStatus] = useState<NineRouterStatus | null>(null);
  const [nineRouterLoading, setNineRouterLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'warning' | 'info'; text: string } | null>(null);

  const showToast = (text: string, type: 'success' | 'warning' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const fetchNineRouterStatus = async () => {
    setNineRouterLoading(true);
    try {
      const res = await fetch('/api/9router/status');
      if (res.ok) {
        const data = await res.json();
        setNineRouterStatus(data);
      }
    } catch (e) {
      console.error('Error fetching 9router status:', e);
    } finally {
      setNineRouterLoading(false);
    }
  };

  // Fetch initial data from server
  const loadData = async () => {
    setLoading(true);
    try {
      const [fRes, cRes, nRes, rRes, aRes, sRes] = await Promise.all([
        fetch('/api/farmers'),
        fetch('/api/commodities'),
        fetch('/api/notifications'),
        fetch('/api/strategic-recommendation'),
        fetch('/api/admins'),
        fetch('/api/suppliers'),
      ]);

      fetchNineRouterStatus();

      if (fRes.ok) {
        const fData = await fRes.json();
        if (Array.isArray(fData) && fData.length > 0) setFarmers(fData);
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        if (Array.isArray(cData) && cData.length > 0) setCommodities(cData);
      }
      if (nRes.ok) {
        const nData = await nRes.json();
        if (Array.isArray(nData) && nData.length > 0) setNotifications(nData);
      }
      if (rRes.ok) {
        const rData = await rRes.json();
        if (rData && rData.judul) setRecommendation(rData);
      }
      if (aRes.ok) {
        const aData = await aRes.json();
        if (Array.isArray(aData) && aData.length > 0) setAdmins(aData);
      }
      if (sRes.ok) {
        const sData = await sRes.json();
        if (Array.isArray(sData) && sData.length > 0) setSuppliers(sData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle adding admin
  const handleAddAdmin = async (newAdmin: Omit<AdminUser, 'id' | 'waktuTerdaftar'>) => {
    try {
      const res = await fetch('/api/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAdmin),
      });
      if (res.ok) {
        const saved = await res.json();
        setAdmins((prev) => [saved, ...prev]);
        showToast(`Nomor ${saved.nama} (${saved.noHp}) berhasil didaftarkan sebagai ${saved.role}!`, 'success');
      } else {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menambahkan admin');
      }
    } catch (err: any) {
      showToast(err.message || 'Gagal menambahkan admin', 'warning');
      throw err;
    }
  };

  // Handle deleting admin
  const handleDeleteAdmin = async (id: string) => {
    try {
      const res = await fetch(`/api/admins/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setAdmins((prev) => prev.filter((a) => a.id !== id));
        showToast('Nomor admin berhasil dicabut dari otorisasi Tani AI.', 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal menghapus admin', 'warning');
    }
  };

  // Handle farmer added via WhatsApp Chatbot
  const handleFarmerRegistered = (newRecord: FarmerRecord) => {
    setFarmers((prev) => [newRecord, ...prev.filter((f) => f.id !== newRecord.id)]);
    showToast(`Data ${newRecord.nama} (${newRecord.komoditas}) berhasil dicatat & disinkronkan ke Google Sheets!`, 'success');
  };

  // Handle manual farmer addition
  const handleAddFarmerManual = async (farmerData: Partial<FarmerRecord>) => {
    try {
      const res = await fetch('/api/farmers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(farmerData),
      });
      if (res.ok) {
        const newRecord = await res.json();
        setFarmers((prev) => [newRecord, ...prev]);
        showToast(`Data ${newRecord.nama} berhasil ditambahkan ke baris Google Sheets.`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan data petani.', 'warning');
    }
  };

  // Handle farmer delete
  const handleDeleteFarmer = async (id: string) => {
    try {
      await fetch(`/api/farmers/${id}`, { method: 'DELETE' });
      setFarmers((prev) => prev.filter((f) => f.id !== id));
      showToast(`Data petani ${id} berhasil dihapus dari Google Sheets.`, 'info');
    } catch (err) {
      console.error(err);
    }
  };

  // Handle supplier registered via WhatsApp or modal
  const handleSupplierRegistered = (newRecord: SupplierRecord) => {
    setSuppliers((prev) => [newRecord, ...prev.filter((s) => s.id !== newRecord.id)]);
    showToast(`Supplier ${newRecord.nama} (${newRecord.kategori}) berhasil disimpan ke Lembar 2 Google Sheets!`, 'success');
  };

  // Handle manual supplier addition
  const handleAddSupplierManual = async (supplierData: Partial<SupplierRecord>) => {
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(supplierData),
      });
      if (res.ok) {
        const newRecord = await res.json();
        setSuppliers((prev) => [newRecord, ...prev]);
        showToast(`Supplier ${newRecord.nama} berhasil ditambahkan ke Lembar 2 Google Sheets.`, 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan data supplier.', 'warning');
    }
  };

  // Handle supplier delete
  const handleDeleteSupplier = async (id: string) => {
    try {
      await fetch(`/api/suppliers/${id}`, { method: 'DELETE' });
      setSuppliers((prev) => prev.filter((s) => s.id !== id));
      showToast(`Data supplier ${id} berhasil dihapus dari Google Sheets.`, 'info');
    } catch (err) {
      console.error(err);
    }
  };

  // Handle price update / anomaly trigger
  const handleUpdateCommodityPrice = async (id: string, newPrice: number, reason: string) => {
    try {
      const res = await fetch('/api/commodities/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, hargaBaru: newPrice, penyebab: reason }),
      });
      if (res.ok) {
        const updated = await res.json();
        setCommodities((prev) => prev.map((c) => (c.id === id ? updated : c)));
        if (updated.statusAnomali === 'LONJAKAN_EKSTREM' || updated.statusAnomali === 'PENURUNAN_DRASTIS') {
          showToast(`⚠️ Anomali terdeteksi pada ${updated.nama}! Status: ${updated.statusAnomali}`, 'warning');
        } else {
          showToast(`Harga ${updated.nama} berhasil diperbarui menjadi Rp ${updated.hargaSekarang.toLocaleString('id-ID')}/kg`, 'info');
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle broadcast notification
  const handleBroadcastNotification = async (commodityId: string) => {
    try {
      const res = await fetch('/api/notifications/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ komoditasId: commodityId }),
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications((prev) => [data.notification, ...prev]);
        showToast(`Pesan broadcast anomali berhasil dikirim ke ${data.recipientsCount} petani melalui WhatsApp.`, 'success');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle generating new AI recommendation
  const handleGenerateRecommendation = async () => {
    setAiGenerating(true);
    try {
      const res = await fetch('/api/strategic-recommendation/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setRecommendation(data);
        showToast('Laporan rekomendasi strategis baru berhasil di-generate oleh AI!', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses analisis AI.', 'warning');
    } finally {
      setAiGenerating(false);
    }
  };

  const anomaliesCount = commodities.filter(
    (c) => c.statusAnomali === 'LONJAKAN_EKSTREM' || c.statusAnomali === 'PENURUNAN_DRASTIS'
  ).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-800 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Navigation */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenWebhookModal={() => setIsWebhookModalOpen(true)}
        onOpenAdminModal={() => setIsAdminManagerOpen(true)}
        onOpenNineRouterModal={() => setIsNineRouterModalOpen(true)}
        onOpenWhitepaperModal={() => setIsWhitepaperModalOpen(true)}
        farmersCount={farmers.length}
        anomaliesCount={anomaliesCount}
        adminsCount={admins.length}
        nineRouterActive={!!nineRouterStatus?.healthy}
      />

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 max-w-md animate-slide-in">
          <div
            className={`p-3.5 rounded-2xl shadow-xl border flex items-center space-x-3 text-xs font-medium ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                : toastMessage.type === 'warning'
                ? 'bg-amber-900 text-amber-100 border-amber-700'
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'warning' ? (
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            ) : (
              <Info className="w-5 h-5 text-sky-400 shrink-0" />
            )}
            <span className="flex-1 leading-snug">{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-white/60 hover:text-white p-1 rounded-full cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className={activeTab === 'map' ? 'flex-1 p-0 overflow-hidden' : 'flex-1 px-4 sm:px-6 lg:px-8 py-4'}>
        {activeTab === 'dashboard' && (
          <AgriProfessionalDashboard
            farmers={farmers}
            commodities={commodities}
            recommendation={recommendation}
            onRefreshData={loadData}
            loading={loading}
            onNavigateToSheets={() => setActiveTab('sheets')}
            onNavigateToChat={() => setActiveTab('chat')}
            onNavigateToMap={() => setActiveTab('map')}
          />
        )}

        {activeTab === 'chat' && (
          <WhatsAppChatbot
            onFarmerRegistered={handleFarmerRegistered}
            onSupplierRegistered={handleSupplierRegistered}
            onNavigateToSheets={() => setActiveTab('sheets')}
            admins={admins}
            onOpenAdminManager={() => setIsAdminManagerOpen(true)}
            nineRouterStatus={nineRouterStatus}
            onOpenNineRouterModal={() => setIsNineRouterModalOpen(true)}
          />
        )}

        {activeTab === 'sheets' && (
          <GoogleSheetsView
            farmers={farmers}
            suppliers={suppliers}
            onAddFarmer={() => setIsAddFarmerModalOpen(true)}
            onAddSupplier={() => setIsAddSupplierModalOpen(true)}
            onDeleteFarmer={handleDeleteFarmer}
            onDeleteSupplier={handleDeleteSupplier}
            onRefresh={loadData}
            loading={loading}
          />
        )}

        {activeTab === 'market' && (
          <MarketAnomalyView
            commodities={commodities}
            notifications={notifications}
            farmers={farmers}
            onUpdateCommodityPrice={handleUpdateCommodityPrice}
            onBroadcastNotification={handleBroadcastNotification}
          />
        )}

        {activeTab === 'datascientist' && (
          <DataScientistPortal
            farmers={farmers}
            commodities={commodities}
            recommendation={recommendation}
            onGenerateNewRecommendation={handleGenerateRecommendation}
            loading={aiGenerating}
          />
        )}

        {activeTab === 'map' && (
          <FarmerSupplierMapView
            farmers={farmers}
            suppliers={suppliers}
            onRefreshData={loadData}
            onAddFarmerClick={() => setIsAddFarmerModalOpen(true)}
          />
        )}
      </main>

      {/* Modals */}
      <WebhookModal
        isOpen={isWebhookModalOpen}
        onClose={() => setIsWebhookModalOpen(false)}
      />

      <AddFarmerModal
        isOpen={isAddFarmerModalOpen}
        onClose={() => setIsAddFarmerModalOpen(false)}
        onAdd={handleAddFarmerManual}
      />

      <AddSupplierModal
        isOpen={isAddSupplierModalOpen}
        onClose={() => setIsAddSupplierModalOpen(false)}
        onAdd={handleAddSupplierManual}
      />

      <AdminManagerModal
        isOpen={isAdminManagerOpen}
        onClose={() => setIsAdminManagerOpen(false)}
        admins={admins}
        onAddAdmin={handleAddAdmin}
        onDeleteAdmin={handleDeleteAdmin}
      />

      <NineRouterModal
        isOpen={isNineRouterModalOpen}
        onClose={() => setIsNineRouterModalOpen(false)}
        status={nineRouterStatus}
        onRefresh={fetchNineRouterStatus}
        isLoading={nineRouterLoading}
      />

      <TechnicalWhitepaperModal
        isOpen={isWhitepaperModalOpen}
        onClose={() => setIsWhitepaperModalOpen(false)}
      />
    </div>
  );
}
