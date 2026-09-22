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
} from 'lucide-react';
import { ChatMessage, FarmerRecord, AdminUser } from '../types';
import { WhatsAppFormattedText } from './WhatsAppFormattedText';
import { WhatsAppVoiceNotePlayer } from './WhatsAppVoiceNotePlayer';
import { soundFx } from '../utils/audio';

interface WhatsAppChatbotProps {
  onFarmerRegistered: (record: FarmerRecord) => void;
  onNavigateToSheets: () => void;
  admins?: AdminUser[];
  onOpenAdminManager?: () => void;
}

export const WhatsAppChatbot: React.FC<WhatsAppChatbotProps> = ({
  onFarmerRegistered,
  onNavigateToSheets,
  admins = [],
  onOpenAdminManager,
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
  const [isRecording, setIsRecording] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [showEditDraft, setShowEditDraft] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: voiceOptions?.transcription || messageText,
          currentDraft: draftFarmer,
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
      };

      setMessages((prev) => [...prev, botMessage]);

      if (soundEnabled) {
        soundFx.playIncomingChime();
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
    } catch (err) {
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
  };

  return (
    <div className="space-y-4 max-w-7xl mx-auto py-2">
      {/* SENDER PHONE & RBAC SIMULATION BAR */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
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
        <div className="lg:col-span-8 flex flex-col h-[740px] bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
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
                      <div className="flex items-center space-x-1.5 mb-1 text-[11px] font-semibold text-emerald-700">
                        <Bot className="w-3.5 h-3.5" />
                        <span>Kang Tani AI</span>
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
              <div className="flex items-center space-x-2 bg-white text-slate-600 px-3 py-2 rounded-xl text-xs shadow-xs w-max border border-slate-100">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.4s]" />
                <span className="text-slate-500 italic">Kang Tani sedang memproses permintaan...</span>
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
                    Simulasi Pesan Suara Petani / Admin (Voice Note)
                  </span>
                </div>
                <button
                  onClick={() => setShowVoiceMenu(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs p-1"
                >
                  <X className="w-4 h-4" />
                </button>
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

            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="bg-[#128C7E] hover:bg-[#075E54] text-white p-2.5 rounded-full shadow transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Right Column: Live Data Extraction HUD & Test Scenarios */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          {/* Active Authority HUD */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
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
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
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
              </div>
            )}
          </div>

          {/* Real-Time Extraction HUD Card */}
          <div className="bg-white rounded-2xl shadow-md border border-slate-200 p-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-slate-800">Ekstraksi Otomatis AI</h4>
                  <p className="text-[11px] text-slate-500">Mendeteksi entitas dari chat WhatsApp</p>
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
