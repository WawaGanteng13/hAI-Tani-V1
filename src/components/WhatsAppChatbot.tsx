import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  CheckCheck,
  Bot,
  User,
  Sparkles,
  Database,
  Phone,
  Video,
  MoreVertical,
  Mic,
  Paperclip,
  Smile,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Lock,
  UserCheck,
  ShieldAlert,
  SlidersHorizontal,
  Volume2,
  VolumeX,
  Copy,
  Check,
  Radio,
  X,
  Save,
  Edit3,
  PlusCircle,
  Cpu,
  Store,
  Building2,
  PackageCheck,
} from 'lucide-react';
import { ChatMessage, FarmerRecord, SupplierRecord, AdminUser, NineRouterStatus } from '../types';
import { WhatsAppFormattedText } from './WhatsAppFormattedText';
import { WhatsAppVoiceNotePlayer } from './WhatsAppVoiceNotePlayer';
import { soundFx } from '../utils/audio';

interface WhatsAppChatbotProps {
  onFarmerRegistered: (record: FarmerRecord) => void;
  onSupplierRegistered?: (record: SupplierRecord) => void;
  onNavigateToSheets: () => void;
  admins?: AdminUser[];
  onOpenAdminManager?: () => void;
  nineRouterStatus?: NineRouterStatus | null;
  onOpenNineRouterModal?: () => void;
}

export const WhatsAppChatbot: React.FC<WhatsAppChatbotProps> = ({
  onFarmerRegistered,
  onSupplierRegistered,
  onNavigateToSheets,
  admins = [],
  onOpenAdminManager,
  nineRouterStatus,
  onOpenNineRouterModal,
}) => {
  // Sender phone for WhatsApp simulation
  const [senderPhone, setSenderPhone] = useState('+62 812-3456-7890'); // Default to Super Admin for easy first-look
  const [customPhone, setCustomPhone] = useState('');
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [showVoiceMenu, setShowVoiceMenu] = useState(false);

  // Normalize phone helper
  const normalize = (p: string) => {
    let clean = p.replace(/[^0-9]/g, '');
    if (clean.startsWith('62')) clean = '0' + clean.slice(2);
    return clean;
  };

  const activeAdmin = admins.find(
    (a) => a.aktif && normalize(a.noHp) === normalize(senderPhone)
  );
  const isSenderAdmin = !!activeAdmin;

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'bot',
      text: '🌾 *Assalamu’alaikum, Sugeng Rahayu!* \n\nSelamat datang di *Kang Tani AI*, layanan asisten WhatsApp resmi sahabat petani Indonesia. \n\nSaya siap membantu mencatat data lahan pertanian ke *Google Sheets* secara otomatis, serta menyiapkan data rekapitulasi untuk *Nomor Petugas/Admin Terdaftar*. \n\nBoleh tahu apa yang bisa Kang Tani bantu hari ini?',
      timestamp: '14:30',
      quickReplies: [
        '📊 Rekap Semua Petani Terdaftar',
        '🌾 Data Panen Padi',
        'Daftarkan Lahan Baru',
        'Cek Harga Pasar Hari Ini',
      ],
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [draftFarmer, setDraftFarmer] = useState<Partial<FarmerRecord>>({});
  const [lastSaved, setLastSaved] = useState<FarmerRecord | null>(null);
  const [draftSupplier, setDraftSupplier] = useState<Partial<SupplierRecord>>({});
  const [lastSavedSupplier, setLastSavedSupplier] = useState<SupplierRecord | null>(null);
  const [activeDraftTab, setActiveDraftTab] = useState<'farmer' | 'supplier'>('farmer');
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSavingSupplierDraft, setIsSavingSupplierDraft] = useState(false);
  const [showEditDraft, setShowEditDraft] = useState(false);
  const [showEditSupplierDraft, setShowEditSupplierDraft] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // AI Cost Optimizer & Cancellation Controller
  const activeAbortControllerRef = useRef<AbortController | null>(null);
  const [aiMetrics, setAiMetrics] = useState<{
    totalCacheHits: number;
    totalTokensSavedEstimate: number;
    cachedItemsCount: number;
    maxOutputTokensLimit: number;
    activeProvider?: string;
  }>({
    totalCacheHits: 0,
    totalTokensSavedEstimate: 0,
    cachedItemsCount: 0,
    maxOutputTokensLimit: 550,
  });

  const fetchAiMetrics = async () => {
    try {
      const res = await fetch('/api/ai/metrics');
      if (res.ok) {
        const data = await res.json();
        setAiMetrics(data);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAiMetrics();
    const interval = setInterval(() => { if (!document.hidden) fetchAiMetrics(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleCancelGeneration = async () => {
    if (activeAbortControllerRef.current) {
      activeAbortControllerRef.current.abort();
      activeAbortControllerRef.current = null;
    }
    setLoading(false);
    try {
      await fetch('/api/chat/cancel', { method: 'POST' });
    } catch {}

    const cancelNotice: ChatMessage = {
      id: `bot-cancel-${Date.now()}`,
      sender: 'bot',
      text: '🛑 *Proses AI Berhasil Dihentikan*\n\nEksekusi model dihentikan seketika untuk menghemat kuota token & memangkas biaya komputasi AI.',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      quickReplies: ['Tanya Ringkasan Cepat', 'Cek Harga Pasar', 'Buka Google Sheets'],
    };
    setMessages((prev) => [...prev, cancelNotice]);
    fetchAiMetrics();
  };

  // Live Real-Microphone Recording State
  const [isRealRecording, setIsRealRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<any>(null);

  const startRealRecording = async () => {
    try {
      setRecordingError(null);
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setRecordingError('Browser Anda tidak mendukung perekaman audio langsung.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        await processRecordedAudio(audioBlob, recordSeconds);
      };

      mediaRecorder.start(250);
      setIsRealRecording(true);
      setRecordSeconds(0);
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
      recordTimerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
    } catch (err: any) {
      console.error('Mic access error:', err);
      setRecordingError('Izin mikrofon ditolak atau tidak tersedia. Silakan gunakan simulasi voice note di bawah.');
    }
  };

  const stopRealRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRealRecording(false);
  };

  const cancelRealRecording = () => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    setIsRealRecording(false);
    setRecordSeconds(0);
  };

  const processRecordedAudio = async (blob: Blob, durationSec: number) => {
    const formattedDuration = `0:${durationSec < 10 ? '0' : ''}${durationSec}`;
    setIsTranscribing(true);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64Data = (reader.result as string).split(',')[1];
        try {
          const res = await fetch('/api/audio-transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Data,
              mimeType: blob.type || 'audio/webm',
            }),
          });
          const result = await res.json();
          const transcript = result.transcription || 'Pesan suara berhasil direkam.';

          if (result.extracted) {
            setDraftFarmer((prev) => ({
              ...prev,
              ...Object.fromEntries(
                Object.entries(result.extracted).filter(([_, v]) => v !== null && v !== undefined && v !== '')
              ),
            }));
          }

          handleSend(transcript, {
            isVoiceNote: true,
            duration: formattedDuration,
            transcription: transcript,
          });
        } catch (apiErr) {
          console.error('Audio transcription API error:', apiErr);
          handleSend('Pesan suara berhasil direkam.', {
            isVoiceNote: true,
            duration: formattedDuration,
            transcription: 'Pesan suara pengguna (audio diproses)',
          });
        } finally {
          setIsTranscribing(false);
        }
      };
    } catch (err) {
      console.error('Process audio error:', err);
      setIsTranscribing(false);
    }
  };

  const isDraftComplete = Boolean(
    draftFarmer.nama &&
      draftFarmer.nama.trim().length > 2 &&
      draftFarmer.komoditas &&
      draftFarmer.komoditas.trim().length > 1 &&
      draftFarmer.luasLahan &&
      Number(draftFarmer.luasLahan) > 0 &&
      (draftFarmer.kabupaten || draftFarmer.alamat)
  );

  const handleSaveDraftToDatabase = async () => {
    if (isSavingDraft) return;

    if (!isDraftComplete) {
      setShowEditDraft(true);
      const missing: string[] = [];
      if (!draftFarmer.nama) missing.push('Nama Petani');
      if (!draftFarmer.komoditas) missing.push('Komoditas Tanaman');
      if (!draftFarmer.luasLahan || Number(draftFarmer.luasLahan) <= 0) missing.push('Luas Lahan');
      if (!draftFarmer.kabupaten && !draftFarmer.alamat) missing.push('Lokasi/Kabupaten');

      const warningMsg: ChatMessage = {
        id: `bot-warn-${Date.now()}`,
        sender: 'bot',
        text: `⚠️ *Data Petani Belum Lengkap!*\n\nSistem tidak dapat menambahkan data yang belum lengkap ke database Google Sheets.\n\n*Bidang yang belum lengkap:*\n${missing.map((m, i) => `${i + 1}. *${m}*`).join('\n')}\n\n💡 _Silakan ketik data yang kurang di chat atau lengkapi form edit draf di samping._`,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        quickReplies: ['Komoditas Cabai', 'Luas Lahan 1 Ha', 'Lokasi di Subang'],
      };
      setMessages((prev) => [...prev, warningMsg]);
      return;
    }

    setIsSavingDraft(true);
    try {
      const payload = {
        nama: draftFarmer.nama,
        noHp: draftFarmer.noHp || senderPhone || '+62 812-3456-7890',
        alamat: draftFarmer.alamat || `Desa Binaan, ${draftFarmer.kabupaten || 'Sentra'}`,
        kabupaten: draftFarmer.kabupaten || 'Subang',
        luasLahan: Number(draftFarmer.luasLahan) || 1.0,
        luasLahanFormatted: draftFarmer.luasLahanFormatted || `${draftFarmer.luasLahan || 1.0} Ha`,
        komoditas: draftFarmer.komoditas,
        varietas: draftFarmer.varietas || 'Unggul Lokal',
        estimasiPanen: draftFarmer.estimasiPanen || 'Desember 2026',
        estimasiHasilTon: Number(draftFarmer.estimasiHasilTon) || (Number(draftFarmer.luasLahan) || 1.0) * 6,
        statusVerifikasi: isSenderAdmin ? 'Terverifikasi' : 'Menunggu Verifikasi',
        catatanAI: isSenderAdmin
          ? `Disimpan langsung oleh Admin ${activeAdmin?.nama} via panel WhatsApp HUD. Sinkron ke Google Sheets.`
          : `Disimpan via validasi lengkap WhatsApp Chatbot. Sinkron ke Google Sheets.`,
      };

      const res = await fetch('/api/farmers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved: FarmerRecord = await res.json();
        setLastSaved(saved);
        onFarmerRegistered(saved);
        if (soundEnabled) soundFx.playSuccessBeep();

        const botMsg: ChatMessage = {
          id: `bot-saved-${Date.now()}`,
          sender: 'bot',
          text: `✅ *Data Petani Lengkap & Berhasil Ditambahkan ke Google Sheets!*\n\n• *ID Registrasi:* \`${saved.id}\`\n• *Nama Petani:* *${saved.nama}*\n• *Komoditas:* *${saved.komoditas}* (${saved.varietas})\n• *Luas Lahan:* *${saved.luasLahanFormatted}*\n• *Lokasi:* ${saved.alamat} (${saved.kabupaten})\n• *Estimasi Panen:* ${saved.estimasiPanen} (~*${saved.estimasiHasilTon} Ton*)\n• *Status:* 🟢 *${saved.statusVerifikasi}*\n• *Baris Google Sheets:* Baris #${saved.googleSheetRow || 'baru'}\n\nData telah otomatis tersimpan dan dapat dilihat langsung di tab *Dashboard* dan *Google Sheets*.`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          quickReplies: ['📊 Rekap Semua Petani', '📥 Buka Google Sheets', '🌾 Tambah Petani Lainnya'],
        };
        setMessages((prev) => [...prev, botMsg]);
        setShowEditDraft(false);
      }
    } catch (err) {
      console.error('Failed to save draft farmer:', err);
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSaveDraftSupplierToDatabase = async () => {
    if (!draftSupplier.nama || !draftSupplier.kategori) {
      alert('Harap lengkapi minimal Nama Toko dan Kategori Usaha Supplier!');
      return;
    }

    setIsSavingSupplierDraft(true);
    try {
      const payload = {
        nama: draftSupplier.nama,
        kategori: draftSupplier.kategori || 'Pupuk & Saprodi',
        kontak: draftSupplier.kontak || senderPhone || '+62 812-xxxx-xxxx',
        alamat: draftSupplier.alamat || 'Jl. Sentra Pertanian Utama',
        kabupaten: draftSupplier.kabupaten || 'Subang, Jawa Barat',
        statusKemitraan: draftSupplier.statusKemitraan || (isSenderAdmin ? 'Terverifikasi Dinas' : 'Mitra Aktif'),
        produkUnggulan:
          Array.isArray(draftSupplier.produkUnggulan) && draftSupplier.produkUnggulan.length > 0
            ? draftSupplier.produkUnggulan
            : ['Pupuk & Saprodi Pertanian'],
        stokTersedia: draftSupplier.stokTersedia || 'Tersedia',
        radiusLayananKm: Number(draftSupplier.radiusLayananKm) || 25,
        jamBuka: draftSupplier.jamBuka || '08.00 - 17.00 WIB',
        petaniBinaanCount: Number(draftSupplier.petaniBinaanCount) || 12,
        catatan: isSenderAdmin
          ? `Disimpan langsung oleh Admin ${activeAdmin?.nama} via WhatsApp HUD ke Google Sheets.`
          : `Disimpan via WhatsApp Chatbot ke Google Sheets.`,
      };

      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const saved: SupplierRecord = await res.json();
        setLastSavedSupplier(saved);
        onSupplierRegistered?.(saved);
        if (soundEnabled) soundFx.playSuccessBeep();

        const botMsg: ChatMessage = {
          id: `bot-sup-saved-${Date.now()}`,
          sender: 'bot',
          text: `✅ *Data Supplier Produk Pertanian Berhasil Ditambahkan ke Google Sheets!*\n\n• *ID Mitra:* \`${saved.id}\`\n• *Nama Toko/Kios:* *${saved.nama}*\n• *Kategori:* *${saved.kategori}*\n• *Kontak WA:* ${saved.kontak}\n• *Wilayah:* ${saved.alamat}, ${saved.kabupaten}\n• *Produk Unggulan:* ${saved.produkUnggulan.join(', ')}\n• *Status Kemitraan:* 🟢 *${saved.statusKemitraan}*\n• *Baris Google Sheets:* Baris #${saved.googleSheetRow || 'baru'}\n\nData supplier kini otomatis terdaftar di Lembar 2 Google Sheets dan peta spasial GIS.`,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          quickReplies: ['🏢 Rekap Supplier Mitra', '📊 Buka Database Sheets', '🌾 Daftarkan Lahan Petani'],
        };
        setMessages((prev) => [...prev, botMsg]);
        setShowEditSupplierDraft(false);
      }
    } catch (err) {
      console.error('Failed to save draft supplier:', err);
    } finally {
      setIsSavingSupplierDraft(false);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMessageId(id);
    setTimeout(() => setCopiedMessageId(null), 2500);
  };

  const handleSend = async (
    textToSend?: string,
    voiceOptions?: { isVoiceNote?: boolean; duration?: string; transcription?: string }
  ) => {
    const messageText = (textToSend || input).trim();
    if (!messageText || loading) return;

    if (soundEnabled) {
      soundFx.playOutgoingTick();
    }

    const userMessageId = `usr-${Date.now()}`;
    const userMessage: ChatMessage = {
      id: userMessageId,
      sender: 'user',
      text: messageText,
      type: voiceOptions?.isVoiceNote ? 'voice_note' : 'text',
      audioDuration: voiceOptions?.duration || '0:14',
      transcription: voiceOptions?.transcription || messageText,
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!textToSend) setInput('');
    setShowVoiceMenu(false);
    setLoading(true);

    const abortController = new AbortController();
    activeAbortControllerRef.current = abortController;

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: abortController.signal,
        body: JSON.stringify({
          message: voiceOptions?.transcription || messageText,
          currentDraft: draftFarmer,
          currentSupplierDraft: draftSupplier,
          senderPhone: senderPhone,
        }),
      });

      const data = await res.json();

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: data.reply || 'Data telah diterima.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        quickReplies: data.quickReplies || ['Cek Harga Pasar', 'Lihat Google Sheets', 'Tanya Seputar Hama'],
        extractedData: data.extracted,
        extractedSupplier: data.extractedSupplier,
        entityType: data.entityType,
        aiProvider: data.aiProvider,
        aiModel: data.aiModel,
        fromCache: data.fromCache,
        tokensUsed: data.tokensUsed,
      };

      setMessages((prev) => [...prev, botMessage]);

      if (soundEnabled) {
        soundFx.playIncomingChime();
      }

      if (data.entityType === 'supplier' || data.extractedSupplier || data.savedSupplier) {
        setActiveDraftTab('supplier');
      }

      if (data.extracted) {
        setDraftFarmer((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.extracted).filter(([_, v]) => v !== null && v !== undefined && v !== '')
          ),
        }));
      }

      if (data.savedRecord) {
        setLastSaved(data.savedRecord);
        onFarmerRegistered(data.savedRecord);
      }

      if (data.extractedSupplier) {
        setDraftSupplier((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.entries(data.extractedSupplier).filter(([_, v]) => v !== null && v !== undefined && v !== '')
          ),
        }));
      }

      if (data.savedSupplier) {
        setLastSavedSupplier(data.savedSupplier);
        onSupplierRegistered?.(data.savedSupplier);
      }

      fetchAiMetrics();
    } catch (err: any) {
      if (err?.name === 'AbortError' || abortController.signal.aborted) {
        console.log('Permintaan AI dibatalkan oleh klien (hemat token).');
        return;
      }
      console.error('Failed to chat:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          sender: 'bot',
          text: 'Mohon maaf Pak/Bu, koneksi sedang sibuk. Silakan coba kembali sesaat lagi.',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
          quickReplies: ['Coba Kirim Ulang', 'Daftarkan Manual'],
        },
      ]);
    } finally {
      setLoading(false);
      activeAbortControllerRef.current = null;
    }
  };

  const simulateVoiceNote = () => {
    setIsRecording(true);
    setTimeout(() => {
      setIsRecording(false);
      handleSend(
        isSenderAdmin
          ? 'Kang Tani AI, tolong siapkan rekap data petani dan proyeksi panen seluruh sentra untuk laporan dinas.'
          : 'Halo Kang Tani, saya Pak Sugeng dari Desa Karangpatihan Magetan. Lahan saya 1.2 hektar ditanami jagung hibrida, perkiraan panen Januari 2027.'
      );
    }, 1500);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: 'm-reset',
        sender: 'bot',
        text: isSenderAdmin
          ? `🎖️ *Halo Bpk/Ibu ${activeAdmin?.nama}!* Sesi baru siap. Anda dapat menyuruh Kang Tani AI untuk merangkum data, mencari komoditas tertentu, atau mengekspor data ke Google Sheets.`
          : '🌾 *Assalamu’alaikum, Mitra Tani!* Sesi percakapan baru telah dimulai. Silakan sampaikan nama Bapak/Ibu, desa/alamat, luas lahan, serta komoditas yang sedang ditanam.',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
        quickReplies: isSenderAdmin
          ? [
              '📊 Rekap Semua Petani',
              '🌾 Data Panen Padi',
              '🌶️ Data Petani Cabai',
              '📥 Siapkan Ekspor Data Sheets',
            ]
          : [
              'Saya Pak Ahmad (Padi 2 Ha Karawang)',
              'Saya Bu Dewi (Cabai Rawit 8000 m2)',
              'Cek Anomali Harga Pasar',
            ],
      },
    ]);
    setDraftFarmer({});
    setLastSaved(null);
    setDraftSupplier({});
    setLastSavedSupplier(null);
  };

  return (
    <div className="app-shell space-y-4 animate-fade-in">
      {/* SENDER PHONE & RBAC SIMULATION BAR */}
      <div className="card p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full md:w-auto">
          <div className="flex items-center space-x-2 shrink-0">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Phone className="w-4 h-4 text-emerald-600" />
              <span>Nomor WhatsApp Pengirim:</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Quick Selector buttons */}
            <button
              onClick={() => {
                setSenderPhone('+62 812-3456-7890');
                setIsCustomMode(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                senderPhone === '+62 812-3456-7890'
                  ? 'bg-amber-100 text-amber-950 font-bold border border-amber-300 ring-2 ring-amber-400/40'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>👑 Ir. Hendra (Kadis)</span>
            </button>

            <button
              onClick={() => {
                setSenderPhone('+62 813-8877-6655');
                setIsCustomMode(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                senderPhone === '+62 813-8877-6655'
                  ? 'bg-emerald-100 text-emerald-950 font-bold border border-emerald-300 ring-2 ring-emerald-400/40'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>🌾 Siti (Koord. PPL)</span>
            </button>

            <button
              onClick={() => {
                setSenderPhone('+62 811-2233-4455');
                setIsCustomMode(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                senderPhone === '+62 811-2233-4455'
                  ? 'bg-purple-100 text-purple-950 font-bold border border-purple-300 ring-2 ring-purple-400/40'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>🔬 Dr. Agus (Data Scientist)</span>
            </button>

            <button
              onClick={() => {
                setSenderPhone('+62 852-9876-1234');
                setIsCustomMode(false);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer flex items-center space-x-1.5 ${
                senderPhone === '+62 852-9876-1234'
                  ? 'bg-sky-100 text-sky-950 font-bold border border-sky-300 ring-2 ring-sky-400/40'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              <span>🧑‍🌾 Pak Joko (Petani Biasa)</span>
            </button>

            <button
              onClick={() => setIsCustomMode(!isCustomMode)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer ${
                isCustomMode
                  ? 'bg-slate-800 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <span>Kustom No...</span>
            </button>
          </div>
        </div>

        {/* Status Indicator & Manage Admin button */}
        <div className="flex items-center space-x-3 self-end md:self-auto">
          {isSenderAdmin ? (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Otoritas: Admin ({activeAdmin?.role})</span>
            </div>
          ) : (
            <div className="bg-slate-100 border border-slate-300 text-slate-700 px-3 py-1.5 rounded-xl text-xs font-medium flex items-center space-x-2">
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Status: Petani Biasa (Privasi Terproteksi)</span>
            </div>
          )}

          {onOpenAdminManager && (
            <button
              onClick={onOpenAdminManager}
              className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span>Kelola Daftar Admin ({admins.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Custom phone input box if toggled */}
      {isCustomMode && (
        <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center space-x-3 text-xs">
          <span className="text-slate-600 font-medium">Input Nomor WhatsApp Pengirim:</span>
          <input
            type="text"
            value={senderPhone}
            onChange={(e) => setSenderPhone(e.target.value)}
            placeholder="+62 8xx-xxxx-xxxx"
            className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-mono text-xs focus:ring-1 focus:ring-emerald-500 focus:outline-none"
          />
          <span className="text-slate-500 text-[11px]">
            {isSenderAdmin ? '✅ Dikenali sebagai Admin' : 'ℹ️ Nomor umum / non-admin'}
          </span>
        </div>
      )}

      {/* Main Grid: WhatsApp Window + HUD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left / Main: WhatsApp Simulator Window */}
        <div className="lg:col-span-8 flex flex-col h-[740px] card shadow-xl border border-slate-200 overflow-hidden">
          {/* WhatsApp Header */}
          <div className="bg-[#075E54] text-white px-4 py-3 flex items-center justify-between shadow-md">
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-emerald-700 border-2 border-emerald-400 flex items-center justify-center font-bold text-base shadow-inner">
                  🌾
                </div>
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-400 border-2 border-[#075E54] rounded-full" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="font-semibold text-sm sm:text-base leading-tight">Kang Tani AI</h3>
                  <span className="bg-emerald-800/90 text-emerald-200 text-[10px] px-1.5 py-0.5 rounded font-medium flex items-center space-x-1">
                    <ShieldCheck className="w-3 h-3 text-emerald-300" />
                    <span>Verified Agri-Bot</span>
                  </span>
                </div>
                <p className="text-xs text-emerald-100 flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
                  <span>
                    {isSenderAdmin
                      ? `Menghubungi: ${activeAdmin?.nama} (${activeAdmin?.instansi})`
                      : 'Online &bull; Sinkronisasi Google Sheets Real-time'}
                  </span>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-emerald-100">
              {onOpenNineRouterModal && (
                <button
                  onClick={onOpenNineRouterModal}
                  title="Klik untuk melihat status 9Router AI Gateway"
                  className={`hidden sm:flex items-center space-x-1 px-2 py-1 rounded-full text-[11px] font-semibold transition cursor-pointer ${
                    nineRouterStatus?.healthy
                      ? 'bg-indigo-900/80 hover:bg-indigo-800 text-indigo-200 border border-indigo-400/40'
                      : 'bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 border border-emerald-600/40'
                  }`}
                >
                  <Cpu className="w-3 h-3" />
                  <span>
                    {nineRouterStatus?.healthy
                      ? `9Router: ${nineRouterStatus.model || 'Active'}`
                      : 'AI Gateway'}
                  </span>
                </button>
              )}

              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                title={soundEnabled ? 'Matikan Suara Pesan' : 'Aktifkan Suara Pesan'}
                className="p-1.5 hover:bg-[#128C7E] rounded-full transition cursor-pointer text-xs flex items-center"
              >
                {soundEnabled ? (
                  <Volume2 className="w-4 h-4 text-emerald-200" />
                ) : (
                  <VolumeX className="w-4 h-4 text-emerald-300/70" />
                )}
              </button>
              <button
                onClick={handleResetChat}
                title="Reset Sesi Chat"
                className="p-1.5 hover:bg-[#128C7E] rounded-full transition cursor-pointer text-xs flex items-center space-x-1"
              >
                <RefreshCw className="w-4 h-4" />
                <span className="hidden sm:inline text-xs">Reset Chat</span>
              </button>
              <div className="h-4 w-px bg-emerald-600 hidden sm:block" />
              <Phone className="w-4 h-4 cursor-pointer hover:text-white" />
              <Video className="w-4 h-4 cursor-pointer hover:text-white" />
              <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
            </div>
          </div>

          {/* WhatsApp Chat Background & Messages */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3 bg-[#EFEAE2]"
            style={{
              backgroundImage: `radial-gradient(#d1d7db 1px, transparent 1px)`,
              backgroundSize: '20px 20px',
            }}
          >
            {/* Security Notice Banner */}
            <div className="flex justify-center">
              <div className="bg-[#FFF8DF] text-[#665c3b] text-[11px] px-3 py-1.5 rounded-lg shadow-sm border border-[#ede3be] text-center max-w-md">
                🔒 Pesan diamankan enkripsi ujung-ke-ujung. Fitur rekap dan penarikan data database hanya diproses bagi *Nomor Admin/Petugas Terdaftar*.
              </div>
            </div>

            {messages.map((msg) => {
              const isBot = msg.sender === 'bot';
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`max-w-[88%] sm:max-w-[80%] rounded-2xl p-3 sm:p-3.5 shadow-sm relative text-sm ${
                      isBot
                        ? 'bg-white text-slate-800 rounded-tl-sm border border-slate-100'
                        : 'bg-[#DCF8C6] text-slate-900 rounded-tr-sm border border-[#cee9b8]'
                    }`}
                  >
                    {/* Sender Tag */}
                    {isBot && (
                      <div className="flex items-center justify-between space-x-2 mb-1">
                        <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-emerald-700">
                          <Bot className="w-3.5 h-3.5" />
                          <span>Kang Tani AI</span>
                        </div>
                        {msg.fromCache ? (
                          <span
                            className="text-[9px] font-mono px-1.5 py-0.5 rounded font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center space-x-1"
                            title="Disajikan instan dari cache hasil (0 token digunakan, 100% hemat biaya)"
                          >
                            <span>⚡ Cache (0 Token)</span>
                          </span>
                        ) : msg.aiProvider && (
                          <span
                            className={`text-[9px] font-mono px-1.5 py-0.2 rounded font-medium ${
                              msg.aiProvider === '9router'
                                ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                : msg.aiProvider === 'gemini'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {msg.aiProvider === '9router'
                              ? `⚡ 9Router (${msg.aiModel || 'gpt-4o'})`
                              : msg.aiProvider === 'gemini'
                              ? `♊ Gemini (${msg.aiModel || 'flash'})`
                              : '🌾 Agronomi Engine'}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Message Body */}
                    {msg.type === 'voice_note' ? (
                      <WhatsAppVoiceNotePlayer
                        duration={msg.audioDuration}
                        transcription={msg.transcription || msg.text}
                        isUser={!isBot}
                        timestamp={msg.timestamp}
                      />
                    ) : (
                      <div className="font-sans text-slate-800">
                        <WhatsAppFormattedText text={msg.text} />
                      </div>
                    )}

                    {/* Copy Button & Timestamp */}
                    <div className="flex items-center justify-end space-x-2 mt-2 pt-1 border-t border-black/5 text-[10px] text-slate-500">
                      <button
                        onClick={() => handleCopyMessage(msg.id, msg.text)}
                        className="hover:text-emerald-700 flex items-center space-x-1 cursor-pointer transition text-[10px] opacity-70 hover:opacity-100"
                        title="Salin isi pesan ini"
                      >
                        {copiedMessageId === msg.id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span className="text-emerald-700 font-semibold">Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Salin</span>
                          </>
                        )}
                      </button>
                      <div className="w-px h-2.5 bg-slate-300" />
                      <span>{msg.timestamp}</span>
                      {!isBot && <CheckCheck className="w-3.5 h-3.5 text-sky-500" />}
                    </div>
                  </div>

                  {/* Quick Reply Chips (if present) */}
                  {isBot && msg.quickReplies && msg.quickReplies.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2 max-w-[90%]">
                      {msg.quickReplies.map((reply, i) => (
                        <button
                          key={i}
                          onClick={() => handleSend(reply)}
                          className="bg-white/95 hover:bg-emerald-50 text-emerald-800 hover:text-emerald-900 text-xs px-2.5 py-1 rounded-full border border-emerald-300/80 shadow-xs font-medium transition cursor-pointer flex items-center space-x-1 active:scale-95"
                        >
                          <span>{reply}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {loading && (
              <div className="flex items-center space-x-2.5 bg-white text-slate-700 px-3.5 py-2 rounded-xl text-xs shadow-xs w-max border border-slate-200">
                <div className="flex items-center space-x-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                </div>
                <span className="text-slate-600 italic">Kang Tani sedang memproses...</span>
                <button
                  type="button"
                  onClick={handleCancelGeneration}
                  className="ml-2 px-2 py-0.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded text-[11px] font-semibold flex items-center space-x-1 transition cursor-pointer active:scale-95"
                  title="Hentikan proses AI sekarang untuk menghemat token dan biaya"
                >
                  <X className="w-3 h-3 text-rose-600" />
                  <span>Hentikan (Hemat Token)</span>
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Real-Time Sync Banner if last record saved */}
          {lastSaved && (
            <div className="bg-emerald-50 border-t border-b border-emerald-200 px-4 py-2 flex items-center justify-between text-xs text-emerald-800">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>{lastSaved.nama}</strong> ({lastSaved.komoditas} - {lastSaved.luasLahanFormatted}) berhasil tercatat ke baris #{lastSaved.googleSheetRow || 'baru'} Google Sheets!
                </span>
              </div>
              <button
                onClick={onNavigateToSheets}
                className="font-semibold text-emerald-700 hover:text-emerald-900 underline flex items-center space-x-1 shrink-0 ml-2 cursor-pointer"
              >
                <span>Buka Sheets</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Smart Prompt Suggestions Bar for Admin */}
          {isSenderAdmin && (
            <div className="px-3 py-1.5 bg-gradient-to-r from-amber-50 to-emerald-50 border-t border-amber-200/70 flex items-center space-x-2 overflow-x-auto text-[11px]">
              <span className="font-bold text-amber-900 shrink-0 flex items-center space-x-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span className="hidden sm:inline">Prompt Cerdas Admin:</span>
                <span className="sm:hidden">Admin:</span>
              </span>
              {[
                '➕ Daftarkan Petani Baru',
                '📊 Proyeksi Panen & Statistik',
                '🌶️ Solusi Lonjakan Harga Cabai',
                '📢 Draf Broadcast Pesan WA ke Petani',
                '⚠️ Cek Petani Belum Verifikasi',
                '🌾 Daftar Kontak Petani Padi',
                '📥 Ekspor Google Sheets',
              ].map((chip, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    if (chip.includes('Daftarkan Petani Baru')) {
                      handleSend('Tani AI, tolong tambahkan dan daftarkan data petani baru: Pak Suparman, no WA 081234567890, komoditas Jagung Hibrida, luas lahan 2.5 Ha di Subang, estimasi panen November 2026 perkiraan hasil 15 ton.');
                    } else {
                      handleSend(chip);
                    }
                  }}
                  className="whitespace-nowrap px-2.5 py-1 rounded-full bg-white hover:bg-amber-100 text-slate-700 hover:text-amber-900 border border-amber-200 shadow-2xs font-medium transition cursor-pointer active:scale-95"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Voice Note Simulation Popover Menu */}
          {showVoiceMenu && (
            <div className="bg-white border-t border-slate-200 p-3 shadow-lg animate-fadeIn">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100">
                <div className="flex items-center space-x-2">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <Mic className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-slate-800">
                    Kirim Pesan Suara (Voice Note WhatsApp)
                  </span>
                </div>
                <button
                  onClick={() => setShowVoiceMenu(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Real Mic Recorder Banner */}
              <div className="mb-3 p-3 rounded-xl border border-emerald-300 bg-gradient-to-r from-emerald-50 to-teal-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
                <div className="flex items-center space-x-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${isRealRecording ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-600 text-white'}`}>
                    <Mic className="w-4 h-4" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-slate-800">
                      {isRealRecording ? `Merekam Suara: 0:${recordSeconds < 10 ? '0' : ''}${recordSeconds}` : 'Rekam Suara Asli (Mikrofon Perangkat)'}
                    </h5>
                    <p className="text-[11px] text-slate-600">
                      {isRealRecording ? 'Bicara sekarang... (Nama, lokasi desa, komoditas, luas lahan)' : 'Didukung transkripsi audio otomatis & ekstraksi AI'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  {!isRealRecording ? (
                    <button
                      onClick={startRealRecording}
                      disabled={isTranscribing}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center space-x-1.5 transition shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <Mic className="w-3.5 h-3.5" />
                      <span>{isTranscribing ? 'Memproses...' : 'Mulai Rekam'}</span>
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={cancelRealRecording}
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
                      >
                        Batal
                      </button>
                      <button
                        onClick={stopRealRecording}
                        className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs transition cursor-pointer"
                      >
                        <span>Selesai & Kirim</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {recordingError && (
                <div className="mb-2 p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-[11px]">
                  {recordingError}
                </div>
              )}

              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                Atau Pilih Contoh Simulasi Rekaman Petani:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <button
                  onClick={() =>
                    handleSend(
                      "Assalamu'alaikum Kang Tani, kula Pak Slamet saking Subang. Lahan kula 2 hektar sampun ditanami pari Ciherang, panenipun kira-kira Desember niki. Nyuwun tulung dicathet nggih.",
                      {
                        isVoiceNote: true,
                        duration: '0:18',
                        transcription:
                          "Assalamu'alaikum Kang Tani, kula Pak Slamet saking Subang. Lahan kula 2 hektar sampun ditanami pari Ciherang, panenipun kira-kira Desember niki. Nyuwun tulung dicathet nggih.",
                      }
                    )
                  }
                  className="text-left p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-100/70 transition cursor-pointer"
                >
                  <div className="font-bold text-emerald-900 flex items-center justify-between">
                    <span>🌾 Pak Slamet (Subang)</span>
                    <span className="text-[10px] text-emerald-600 font-mono">0:18</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                    "Kula Pak Slamet saking Subang, lahan 2 hektar tanam padi Ciherang panen Desember..."
                  </p>
                </button>

                <button
                  onClick={() =>
                    handleSend(
                      'Halo Kang Tani, saya Ibu Marni dari Pare Kediri. Mau daftarkan kebun cabai rawit merah luasnya 0.8 hektar, estimasi panen bulan November 2026.',
                      {
                        isVoiceNote: true,
                        duration: '0:14',
                        transcription:
                          'Halo Kang Tani, saya Ibu Marni dari Pare Kediri. Mau daftarkan kebun cabai rawit merah luasnya 0.8 hektar, estimasi panen bulan November 2026.',
                      }
                    )
                  }
                  className="text-left p-2.5 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-100/70 transition cursor-pointer"
                >
                  <div className="font-bold text-rose-900 flex items-center justify-between">
                    <span>🌶️ Bu Marni (Kediri)</span>
                    <span className="text-[10px] text-rose-600 font-mono">0:14</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                    "Ibu Marni Pare Kediri, daftar kebun cabai rawit merah 0.8 hektar panen November..."
                  </p>
                </button>

                <button
                  onClick={() =>
                    handleSend(
                      'Selamat siang Kang Tani. Kula Pak Harto saking Larangan Brebes, nandur brambang Bima Brebes 1.5 hektar. Estimasi panen Januari tahun ngajeng.',
                      {
                        isVoiceNote: true,
                        duration: '0:15',
                        transcription:
                          'Selamat siang Kang Tani. Kula Pak Harto saking Larangan Brebes, nandur brambang Bima Brebes 1.5 hektar. Estimasi panen Januari tahun ngajeng.',
                      }
                    )
                  }
                  className="text-left p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 transition cursor-pointer"
                >
                  <div className="font-bold text-amber-900 flex items-center justify-between">
                    <span>🧅 Pak Harto (Brebes)</span>
                    <span className="text-[10px] text-amber-600 font-mono">0:15</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                    "Pak Harto Larangan Brebes, tanam bawang merah Bima 1.5 hektar panen Januari..."
                  </p>
                </button>

                <button
                  onClick={() =>
                    handleSend(
                      'Kang Tani AI, tolong siapkan ringkasan rekapitulasi luasan lahan dan estimasi tonase panen untuk seluruh sentra.',
                      {
                        isVoiceNote: true,
                        duration: '0:11',
                        transcription:
                          'Kang Tani AI, tolong siapkan ringkasan rekapitulasi luasan lahan dan estimasi tonase panen untuk seluruh sentra.',
                      }
                    )
                  }
                  className="text-left p-2.5 rounded-xl border border-sky-200 bg-sky-50/50 hover:bg-sky-100/70 transition cursor-pointer"
                >
                  <div className="font-bold text-sky-900 flex items-center justify-between">
                    <span>🎖️ Voice Note Petugas Dinas</span>
                    <span className="text-[10px] text-sky-600 font-mono">0:11</span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 line-clamp-2">
                    "Kang Tani AI, tolong siapkan ringkasan rekapitulasi luasan lahan dan estimasi panen..."
                  </p>
                </button>
              </div>
            </div>
          )}

          {/* Input Bar */}
          <div className="p-3 bg-[#F0F2F5] border-t border-slate-200 flex items-center space-x-2">
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700 p-1.5 transition"
              title="Emoji"
            >
              <Smile className="w-5 h-5" />
            </button>
            <button
              type="button"
              className="text-slate-500 hover:text-slate-700 p-1.5 transition"
              title="Kirim Dokumen Lahan / Lampiran"
              onClick={() => handleSend('Saya ingin mengirimkan dokumen luas lahan pertanian.')}
            >
              <Paperclip className="w-5 h-5" />
            </button>

            {isRealRecording ? (
              <div className="flex-1 flex items-center justify-between bg-rose-50 border border-rose-300 rounded-full px-4 py-1.5 shadow-2xs">
                <div className="flex items-center space-x-2 text-rose-700 font-mono text-xs font-bold">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-600 animate-pulse"></span>
                  <span>Merekam: 0:{recordSeconds < 10 ? '0' : ''}{recordSeconds}</span>
                  <span className="text-[11px] text-slate-500 font-sans hidden sm:inline">(Bicara jelas ke mikrofon)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={cancelRealRecording}
                    className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 rounded cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={stopRealRecording}
                    className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-full text-xs font-bold shadow-xs cursor-pointer"
                  >
                    Kirim Suara
                  </button>
                </div>
              </div>
            ) : isTranscribing ? (
              <div className="flex-1 flex items-center space-x-2 bg-emerald-50 border border-emerald-300 rounded-full px-4 py-2 text-xs text-emerald-800">
                <RefreshCw className="w-3.5 h-3.5 animate-spin text-emerald-600" />
                <span>Memproses rekaman audio & transkripsi Gemini AI...</span>
              </div>
            ) : (
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder={
                  isSenderAdmin
                    ? "Instruksikan apapun ke AI (analisis panen, draf broadcast, solusi harga, ekspor data)..."
                    : "Ketik pesan (contoh: Pak Joko, sawah 2 Ha padi di Karawang, panen Nov)..."
                }
                className="flex-1 bg-white border border-slate-300 rounded-full px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
              />
            )}

            <button
              type="button"
              onClick={() => setShowVoiceMenu(!showVoiceMenu)}
              className={`p-2 rounded-full transition cursor-pointer ${
                showVoiceMenu
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-500 hover:text-emerald-700 hover:bg-slate-200'
              }`}
              title="Kirim Pesan Suara / Voice Note"
            >
              <Mic className="w-5 h-5" />
            </button>

            {loading ? (
              <button
                type="button"
                onClick={handleCancelGeneration}
                className="bg-rose-600 hover:bg-rose-700 text-white p-2.5 rounded-full shadow transition cursor-pointer active:scale-95 flex items-center justify-center animate-pulse"
                title="Hentikan proses AI sekarang (Hemat Biaya & Token)"
              >
                <X className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim()}
                className="bg-[#128C7E] hover:bg-[#075E54] text-white p-2.5 rounded-full shadow transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Right Column: Live Data Extraction HUD & Test Scenarios */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          {/* AI Cost & Token Efficiency Card */}
          <div className="bg-gradient-to-br from-emerald-50/80 via-teal-50/40 to-white rounded-2xl shadow-md border border-emerald-200/90 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-emerald-200/60">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wide">
                    Efisiensi Biaya & Token AI
                  </h4>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Optimasi 3-Pilar Aktif
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold">
                LEAN & FAST
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-center">
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 block">Cache Digunakan</span>
                <span className="text-base font-extrabold text-emerald-700 font-mono">
                  {aiMetrics.totalCacheHits}x
                </span>
                <span className="text-[9px] text-slate-400 block">0 token keluar</span>
              </div>
              <div className="bg-white/80 p-2.5 rounded-xl border border-emerald-100 shadow-2xs">
                <span className="text-[10px] text-slate-500 block">Estimasi Token Dihemat</span>
                <span className="text-base font-extrabold text-teal-700 font-mono">
                  ~{aiMetrics.totalTokensSavedEstimate.toLocaleString("id-ID")}
                </span>
                <span className="text-[9px] text-slate-400 block">efisiensi biaya</span>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div className="flex items-start space-x-2 text-slate-700 bg-white/60 p-2 rounded-lg border border-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-[11px]">
                  <strong>1. Konteks Selektif Ringkas:</strong> Hanya data relevan & ringkasan yang dikirim, bukan tumpukan database utuh.
                </span>
              </div>
              <div className="flex items-start space-x-2 text-slate-700 bg-white/60 p-2 rounded-lg border border-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-[11px]">
                  <strong>2. Pembatasan & Pembatalan:</strong> Output dibatasi 550 token dan tombol Stop menghentikan proses seketika.
                </span>
              </div>
              <div className="flex items-start space-x-2 text-slate-700 bg-white/60 p-2 rounded-lg border border-emerald-100">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                <span className="text-[11px]">
                  <strong>3. Memori Cache Otomatis:</strong> Hasil laporan/jawaban disimpan dan digunakan kembali tanpa memanggil AI berulang.
                </span>
              </div>
            </div>
          </div>

          {/* Active Authority HUD */}
          <div className="card shadow-md border border-slate-200 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold ${
                    isSenderAdmin
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isSenderAdmin ? <ShieldCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">
                    {isSenderAdmin ? 'Otoritas Admin Aktif' : 'Status Pengirim: Nomor Umum'}
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    {isSenderAdmin
                      ? activeAdmin?.instansi
                      : 'Hanya pendaftaran & konsultasi'}
                  </p>
                </div>
              </div>
              <span
                className={`text-[10px] font-mono px-2 py-0.5 rounded-full border font-bold ${
                  isSenderAdmin
                    ? 'bg-amber-50 text-amber-800 border-amber-300'
                    : 'bg-slate-50 text-slate-700 border-slate-200'
                }`}
              >
                {isSenderAdmin ? 'ADMIN GRANTED' : 'RESTRICTED'}
              </span>
            </div>

            <div className="mt-3 text-xs space-y-2">
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500">Nomor Aktif:</span>
                <span className="font-mono font-bold text-slate-800">{senderPhone}</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500">Hak Akses Rekap:</span>
                <span className={`font-semibold ${isSenderAdmin ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {isSenderAdmin ? '✅ Diizinkan Penuh' : '❌ Ditolak (Privasi)'}
                </span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                <span className="text-slate-500">Perintah Eksekutif:</span>
                <span className={`font-semibold ${isSenderAdmin ? 'text-emerald-700' : 'text-slate-500'}`}>
                  {isSenderAdmin ? '✅ Aktif' : '— Tidak Berhak'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Interactive Tests */}
          <div className="card shadow-md border border-slate-200 p-5">
            <h4 className="font-bold text-xs text-slate-700 uppercase tracking-wider mb-2">
              Uji Coba Cepat Peran (RBAC)
            </h4>
            <p className="text-xs text-slate-500 mb-3">
              Klik aksi di bawah ini untuk melihat langsung respons cerdas Tani AI:
            </p>

            {isSenderAdmin ? (
              /* Admin Scenarios */
              <div className="space-y-2">
                <button
                  onClick={() =>
                    handleSend('Tani AI, tolong daftarkan data petani binaan baru: Pak Suparman, no WA +62 812-7788-9900, komoditas Jagung Hibrida, luas lahan 2.5 Ha di Subang, estimasi panen November 2026 perkiraan hasil 15 ton.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-emerald-300 bg-emerald-50/70 hover:bg-emerald-100/90 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-bold text-emerald-900 flex items-center space-x-1.5">
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-700" />
                    <span>➕ Tambah Data Petani Baru (PPL / Dinas)</span>
                  </div>
                  <div className="text-[11px] text-emerald-800/80 mt-0.5">
                    Admin mendaftarkan petani langsung via chat dan tersinkronkan ke Google Sheets secara instan.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Tani AI, tolong daftarkan supplier produk pertanian mitra baru: Kios Tani Berkah Makmur di Subang, kontak WA 081299887711, kategori Pupuk & Saprodi, produk unggulan: Pupuk Urea Petro, NPK Phonska Plus, Benih Ciherang, stok tersedia 20 Ton.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-blue-300 bg-blue-50/70 hover:bg-blue-100/90 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-bold text-blue-900 flex items-center space-x-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-700" />
                    <span>🏢 Daftarkan Supplier Saprodi Baru (Admin)</span>
                  </div>
                  <div className="text-[11px] text-blue-800/80 mt-0.5">
                    Admin mendaftarkan toko pupuk / distributor saprodi langsung ke Lembar 2 Google Sheets.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Tani AI, tolong buatkan rekapitulasi data petani, total luas lahan, dan proyeksi panen seluruh komoditas.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-100/70 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-bold text-amber-900 flex items-center space-x-1.5">
                    <span>📊 Rekapitulasi & Proyeksi Panen</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Kalkulasi otomatis total luas (Ha), estimasi tonase, dan sebaran komoditas.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Kang Tani, harga cabai rawit melonjak drastis +36.7% hari ini. Berikan analisis penyebab dan rekomendasi taktis dinas untuk stabilisasi pasokan.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-rose-200 bg-rose-50/40 hover:bg-rose-100/70 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-bold text-rose-800 flex items-center space-x-1.5">
                    <span>🌶️ Solusi Anomali Harga Cabai</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Analisis rantai pasok dan langkah intervensi pasar/logistik dinas.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Tani AI, buatkan draf pesan WhatsApp resmi dari Dinas untuk disebarkan ke ketua kelompok tani mengenai antisipasi hama pasca-hujan dan jadwal panen.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/40 hover:bg-emerald-100/70 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-bold text-emerald-800 flex items-center space-x-1.5">
                    <span>📢 Buatkan Draf Broadcast WA Resmi</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Menghasilkan format pesan WhatsApp siap broadcast lengkap dengan salam dan himbauan.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Tani AI, tampilkan daftar petani yang statusnya masih belum terverifikasi untuk kami jadwalkan ground-check PPL.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-amber-200 hover:border-amber-400 hover:bg-amber-50/50 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-bold text-amber-800 flex items-center space-x-1.5">
                    <span>⚠️ Audit Petani Belum Verifikasi</span>
                  </div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Menyaring data yang memerlukan validasi polygon lahan oleh penyuluh.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Tani AI, tampilkan daftar petani komoditas padi beserta luas lahan dan nomor kontaknya.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-bold text-emerald-800">🌾 Filter Spesifik: Petani Padi</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Menyaring data nama, HP, dan luasan khusus komoditas padi.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Tani AI, siapkan link unduh dan ekspor data Google Sheets untuk laporan dinas.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/50 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-bold text-indigo-800">📥 Siapkan Ekspor Data Sheets</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Mendapatkan link file CSV & tampilan live spreadsheet.
                  </div>
                </button>
              </div>
            ) : (
              /* Non-Admin / Petani Biasa Scenarios */
              <div className="space-y-2">
                <button
                  onClick={() =>
                    handleSend('Tani AI, tolong kirimkan rekap semua data petani dan nomor HP mereka ke saya.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-rose-200 bg-rose-50/60 hover:bg-rose-100/80 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-bold text-rose-800 flex items-center space-x-1">
                    <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                    <span>🔒 Uji Penolakan: Minta Seluruh Data Petani</span>
                  </div>
                  <div className="text-[11px] text-rose-700/80 mt-0.5">
                    Melihat Kang Tani AI menolak permohonan demi menjaga privasi petani.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Nama saya Pak Slamet, alamat Desa Klampok Brebes, punya lahan 0.8 hektar ditanami bawang merah varietas Bima Brebes, rencana panen Desember 2026 estimasi 8 ton.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-xs text-slate-700 transition cursor-pointer"
                >
                  <div className="font-semibold text-emerald-800">🧅 Daftarkan Lahan Saya (Pak Slamet)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Petani biasa diizinkan mendaftarkan lahan & hasil panen sendiri.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Kang Tani, bagaimana harga cabai rawit hari ini di pasar induk? Katanya ada lonjakan ekstrem ya?')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-xs text-slate-700 transition cursor-pointer"
                >
                  <div className="font-semibold text-emerald-800">📈 Konsultasi Anomali Harga Pasar</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Konsultasi harga pasar & rekomendasi pemupukan tetap terbuka untuk semua.
                  </div>
                </button>

                <button
                  onClick={() =>
                    handleSend('Halo Kang Tani, saya mau daftarkan toko saprodi pertanian: Toko Tani Maju di Karawang, kontak WA 081388776655, kategori Pupuk & Saprodi, produk unggulan NPK Kebomas dan Benih Padi Inpari 32, stok 15 ton.')
                  }
                  className="w-full text-left p-2.5 rounded-xl border border-blue-200 hover:border-blue-400 hover:bg-blue-50/60 text-xs text-slate-800 transition cursor-pointer"
                >
                  <div className="font-semibold text-blue-800 flex items-center space-x-1.5">
                    <Store className="w-3.5 h-3.5 text-blue-600" />
                    <span>🏪 Daftarkan Usaha Kios / Supplier Pertanian</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Kios atau distributor mendaftarkan nomor kontak, katalog produk, dan stok via WhatsApp.
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* Real-Time Extraction HUD Card */}
          <div className="card shadow-md border border-slate-200 p-5">
            {/* Draft Mode Selector Tabs */}
            <div className="flex rounded-xl bg-slate-100 p-1 mb-4">
              <button
                onClick={() => setActiveDraftTab('farmer')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                  activeDraftTab === 'farmer'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🧑‍🌾 Draf Petani</span>
                {draftFarmer.nama && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
              </button>
              <button
                onClick={() => setActiveDraftTab('supplier')}
                className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                  activeDraftTab === 'supplier'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏢 Draf Supplier</span>
                {draftSupplier.nama && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
              </button>
            </div>

            {activeDraftTab === 'farmer' ? (
              /* FARMER DRAFT CARD */
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">Ekstraksi Otomatis AI (Petani)</h4>
                      <p className="text-[11px] text-slate-500">Mendeteksi data lahan & komoditas dari chat</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      isDraftComplete
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {isDraftComplete ? '🟢 Data Lengkap' : '🟡 Draf Belum Lengkap'}
                  </span>
                </div>

                {/* Completeness Checklist Indicators */}
                <div className="grid grid-cols-2 gap-1.5 mt-2.5 p-2 bg-slate-50 rounded-xl text-[11px]">
                  <div className="flex items-center space-x-1">
                    <span className={draftFarmer.nama ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {draftFarmer.nama ? '✓' : '○'}
                    </span>
                    <span className={draftFarmer.nama ? 'text-slate-700 font-medium' : 'text-slate-400'}>Nama Petani</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={draftFarmer.komoditas ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {draftFarmer.komoditas ? '✓' : '○'}
                    </span>
                    <span className={draftFarmer.komoditas ? 'text-slate-700 font-medium' : 'text-slate-400'}>Komoditas</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={draftFarmer.luasLahan && Number(draftFarmer.luasLahan) > 0 ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {draftFarmer.luasLahan && Number(draftFarmer.luasLahan) > 0 ? '✓' : '○'}
                    </span>
                    <span className={draftFarmer.luasLahan && Number(draftFarmer.luasLahan) > 0 ? 'text-slate-700 font-medium' : 'text-slate-400'}>Luas Lahan</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={draftFarmer.kabupaten || draftFarmer.alamat ? 'text-emerald-600 font-bold' : 'text-slate-400'}>
                      {draftFarmer.kabupaten || draftFarmer.alamat ? '✓' : '○'}
                    </span>
                    <span className={draftFarmer.kabupaten || draftFarmer.alamat ? 'text-slate-700 font-medium' : 'text-slate-400'}>Lokasi Wilayah</span>
                  </div>
                </div>

                {showEditDraft ? (
                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Nama Petani:</label>
                      <input
                        type="text"
                        value={draftFarmer.nama || ''}
                        onChange={(e) => setDraftFarmer((prev) => ({ ...prev, nama: e.target.value }))}
                        placeholder="Contoh: Pak Suparman"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-emerald-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Komoditas:</label>
                        <input
                          type="text"
                          value={draftFarmer.komoditas || ''}
                          onChange={(e) => setDraftFarmer((prev) => ({ ...prev, komoditas: e.target.value }))}
                          placeholder="Jagung / Padi / Cabai"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Luas Lahan (Ha):</label>
                        <input
                          type="number"
                          step="0.1"
                          value={draftFarmer.luasLahan || ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setDraftFarmer((prev) => ({
                              ...prev,
                              luasLahan: val,
                              luasLahanFormatted: `${val} Ha`,
                              estimasiHasilTon: Number((val * 6).toFixed(1)),
                            }));
                          }}
                          placeholder="1.5"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-emerald-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Kabupaten:</label>
                        <input
                          type="text"
                          value={draftFarmer.kabupaten || ''}
                          onChange={(e) => setDraftFarmer((prev) => ({ ...prev, kabupaten: e.target.value }))}
                          placeholder="Subang"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Estimasi Panen:</label>
                        <input
                          type="text"
                          value={draftFarmer.estimasiPanen || ''}
                          onChange={(e) => setDraftFarmer((prev) => ({ ...prev, estimasiPanen: e.target.value }))}
                          placeholder="Desember 2026"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Nama Petani:</span>
                      <span className="font-semibold text-slate-800">{draftFarmer.nama || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Komoditas:</span>
                      <span className="font-semibold text-slate-800">{draftFarmer.komoditas || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Luas Lahan:</span>
                      <span className="font-semibold text-emerald-700">{draftFarmer.luasLahanFormatted || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Lokasi / Kabupaten:</span>
                      <span className="font-semibold text-slate-700">{draftFarmer.kabupaten || draftFarmer.alamat || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Estimasi Panen:</span>
                      <span className="font-semibold text-amber-700">{draftFarmer.estimasiPanen || '—'}</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSaveDraftToDatabase}
                      disabled={isSavingDraft}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-xs cursor-pointer ${
                        isDraftComplete
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {isSavingDraft
                          ? 'Menyimpan ke Sheets...'
                          : isDraftComplete
                          ? 'Simpan Data Lengkap ke Google Sheets'
                          : 'Lengkapi Draf Terlebih Dahulu'}
                      </span>
                    </button>

                    <button
                      onClick={() => setShowEditDraft(!showEditDraft)}
                      className="px-2.5 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs text-slate-600 font-medium transition cursor-pointer"
                      title="Sesuaikan Form Data"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {(!draftFarmer.nama && !draftFarmer.komoditas) && (
                    <button
                      onClick={() => {
                        setDraftFarmer({
                          nama: 'Pak Suparman',
                          noHp: '+62 812-7788-9900',
                          alamat: 'Desa Compreng RT 03/04',
                          kabupaten: 'Subang',
                          luasLahan: 2.5,
                          luasLahanFormatted: '2.5 Ha (25.000 m²)',
                          komoditas: 'Jagung Hibrida',
                          varietas: 'Bisi 18',
                          estimasiPanen: 'November 2026',
                          estimasiHasilTon: 15.0,
                        });
                      }}
                      className="w-full py-1.5 px-2 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-xl text-[11px] font-semibold flex items-center justify-center space-x-1 transition cursor-pointer"
                    >
                      <PlusCircle className="w-3 h-3 text-emerald-600" />
                      <span>Isi Draf Contoh: Pak Suparman (Jagung 2.5 Ha)</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              /* SUPPLIER DRAFT CARD */
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                      <Store className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">Ekstraksi Otomatis AI (Supplier)</h4>
                      <p className="text-[11px] text-slate-500">Mendeteksi profil kios & stok saprodi dari chat</p>
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${
                      draftSupplier.nama && draftSupplier.kategori
                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {draftSupplier.nama && draftSupplier.kategori ? '🟢 Data Lengkap' : '🟡 Draf Belum Lengkap'}
                  </span>
                </div>

                {/* Completeness Checklist Indicators */}
                <div className="grid grid-cols-2 gap-1.5 mt-2.5 p-2 bg-slate-50 rounded-xl text-[11px]">
                  <div className="flex items-center space-x-1">
                    <span className={draftSupplier.nama ? 'text-blue-600 font-bold' : 'text-slate-400'}>
                      {draftSupplier.nama ? '✓' : '○'}
                    </span>
                    <span className={draftSupplier.nama ? 'text-slate-700 font-medium' : 'text-slate-400'}>Nama Toko/Kios</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={draftSupplier.kategori ? 'text-blue-600 font-bold' : 'text-slate-400'}>
                      {draftSupplier.kategori ? '✓' : '○'}
                    </span>
                    <span className={draftSupplier.kategori ? 'text-slate-700 font-medium' : 'text-slate-400'}>Kategori Usaha</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={draftSupplier.kontak ? 'text-blue-600 font-bold' : 'text-slate-400'}>
                      {draftSupplier.kontak ? '✓' : '○'}
                    </span>
                    <span className={draftSupplier.kontak ? 'text-slate-700 font-medium' : 'text-slate-400'}>Kontak WA</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span className={draftSupplier.kabupaten || draftSupplier.alamat ? 'text-blue-600 font-bold' : 'text-slate-400'}>
                      {draftSupplier.kabupaten || draftSupplier.alamat ? '✓' : '○'}
                    </span>
                    <span className={draftSupplier.kabupaten || draftSupplier.alamat ? 'text-slate-700 font-medium' : 'text-slate-400'}>Lokasi Wilayah</span>
                  </div>
                </div>

                {showEditSupplierDraft ? (
                  <div className="mt-3 space-y-2 text-xs">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Nama Toko / Kios / Usaha:</label>
                      <input
                        type="text"
                        value={draftSupplier.nama || ''}
                        onChange={(e) => setDraftSupplier((prev) => ({ ...prev, nama: e.target.value }))}
                        placeholder="Contoh: Kios Tani Berkah Makmur"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Kategori Usaha:</label>
                        <select
                          value={draftSupplier.kategori || 'Pupuk & Saprodi'}
                          onChange={(e) => setDraftSupplier((prev) => ({ ...prev, kategori: e.target.value as any }))}
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-500"
                        >
                          <option value="Pupuk & Saprodi">Pupuk & Saprodi</option>
                          <option value="Bibit & Benih">Bibit & Benih</option>
                          <option value="Alat & Mesin Pertanian">Alat & Mesin Pertanian</option>
                          <option value="Offtaker & Pengepul">Offtaker & Pengepul</option>
                          <option value="Koperasi Tani">Koperasi Tani</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Kontak WhatsApp:</label>
                        <input
                          type="text"
                          value={draftSupplier.kontak || ''}
                          onChange={(e) => setDraftSupplier((prev) => ({ ...prev, kontak: e.target.value }))}
                          placeholder="+62 812-xxxx-xxxx"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-500"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Kabupaten / Kota:</label>
                        <input
                          type="text"
                          value={draftSupplier.kabupaten || ''}
                          onChange={(e) => setDraftSupplier((prev) => ({ ...prev, kabupaten: e.target.value }))}
                          placeholder="Subang"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-500"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-slate-500 block mb-0.5">Stok Tersedia:</label>
                        <input
                          type="text"
                          value={draftSupplier.stokTersedia || ''}
                          onChange={(e) => setDraftSupplier((prev) => ({ ...prev, stokTersedia: e.target.value }))}
                          placeholder="20 Ton Urea"
                          className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-0.5">Produk Unggulan (pisahkan koma):</label>
                      <input
                        type="text"
                        value={
                          Array.isArray(draftSupplier.produkUnggulan)
                            ? draftSupplier.produkUnggulan.join(', ')
                            : draftSupplier.produkUnggulan || ''
                        }
                        onChange={(e) =>
                          setDraftSupplier((prev) => ({
                            ...prev,
                            produkUnggulan: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                          }))
                        }
                        placeholder="Pupuk Urea, NPK Phonska Plus, Benih Padi Ciherang"
                        className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold focus:outline-blue-500"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 space-y-2 text-xs">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Nama Toko/Kios:</span>
                      <span className="font-semibold text-slate-800">{draftSupplier.nama || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Kategori Usaha:</span>
                      <span className="font-semibold text-blue-700">{draftSupplier.kategori || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Kontak WA:</span>
                      <span className="font-semibold text-slate-800">{draftSupplier.kontak || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Wilayah:</span>
                      <span className="font-semibold text-slate-700">{draftSupplier.kabupaten || draftSupplier.alamat || '—'}</span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Produk Unggulan:</span>
                      <span className="font-semibold text-slate-700">
                        {Array.isArray(draftSupplier.produkUnggulan)
                          ? draftSupplier.produkUnggulan.join(', ')
                          : draftSupplier.produkUnggulan || '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg">
                      <span className="text-slate-500">Stok Tersedia:</span>
                      <span className="font-semibold text-emerald-700">{draftSupplier.stokTersedia || '—'}</span>
                    </div>
                  </div>
                )}

                <div className="mt-4 pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handleSaveDraftSupplierToDatabase}
                      disabled={isSavingSupplierDraft}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition shadow-xs cursor-pointer ${
                        draftSupplier.nama && draftSupplier.kategori
                          ? 'bg-blue-600 hover:bg-blue-700 text-white'
                          : 'bg-amber-600 hover:bg-amber-700 text-white'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>
                        {isSavingSupplierDraft
                          ? 'Menyimpan Supplier...'
                          : draftSupplier.nama && draftSupplier.kategori
                          ? 'Simpan Data Supplier ke Google Sheets'
                          : 'Lengkapi Nama Toko & Kategori'}
                      </span>
                    </button>

                    <button
                      onClick={() => setShowEditSupplierDraft(!showEditSupplierDraft)}
                      className="px-2.5 py-2 border border-slate-200 hover:bg-slate-100 rounded-xl text-xs text-slate-600 font-medium transition cursor-pointer"
                      title="Sesuaikan Form Data Supplier"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {(!draftSupplier.nama) && (
                    <button
                      onClick={() => {
                        setDraftSupplier({
                          nama: 'Kios Tani Berkah Makmur',
                          kategori: 'Pupuk & Saprodi',
                          kontak: '+62 812-9988-7711',
                          alamat: 'Jl. Raya Subang - Pagaden No. 45',
                          kabupaten: 'Subang, Jawa Barat',
                          statusKemitraan: 'Terverifikasi Dinas',
                          produkUnggulan: ['Pupuk Urea Petro', 'NPK Phonska Plus', 'Benih Ciherang'],
                          stokTersedia: '20 Ton (Ready Stok)',
                          radiusLayananKm: 30,
                          jamBuka: '07.30 - 17.00 WIB',
                          petaniBinaanCount: 45,
                        });
                      }}
                      className="w-full py-1.5 px-2 bg-blue-50/70 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl text-[11px] font-semibold flex items-center justify-center space-x-1 transition cursor-pointer"
                    >
                      <PlusCircle className="w-3 h-3 text-blue-600" />
                      <span>Isi Draf Contoh: Kios Tani Berkah (Pupuk 20 Ton Subang)</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-3 pt-3 border-t border-slate-100">
              <button
                onClick={onNavigateToSheets}
                className="w-full py-2 px-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center space-x-2 transition shadow-xs cursor-pointer"
              >
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Buka Database Google Sheets</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
