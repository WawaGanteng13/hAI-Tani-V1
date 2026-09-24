import React, { useState, useEffect } from 'react';
import {
  X,
  Copy,
  Check,
  Radio,
  ExternalLink,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  FileSpreadsheet,
  Activity,
  Zap,
  RefreshCw,
} from 'lucide-react';

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WebhookModal: React.FC<WebhookModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'appscript' | 'whatsapp'>('appscript');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);

  // Ping test state
  const [isPinging, setIsPinging] = useState(false);
  const [pingResult, setPingResult] = useState<{ ok: boolean; message: string; timestamp: string } | null>(null);

  // Webhook logs state
  const [logs, setLogs] = useState<Array<{ id: string; timestamp: string; event: string; detail: string; status: string }>>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const sheetsWebhookUrl = `${currentOrigin}/api/webhook`;
  const whatsappWebhookUrl = `${currentOrigin}/api/webhook/whatsapp`;
  const verifyToken = 'tani_ai_webhook_verify_token';

  const appsScriptCode = `/**
 * TaniAI Google Apps Script Bi-Directional Webhook
 * Sinkronisasi Otomatis 2-Arah saat Sel di Google Sheets Diedit
 *
 * PANDUAN PEMASANGAN:
 * 1. Buka file Google Sheets Anda.
 * 2. Klik menu "Extensions" (Ekstensi) > "Apps Script".
 * 3. Hapus kode default (jika ada), lalu tempelkan seluruh kode ini.
 * 4. Simpan (Save) proyek Apps Script (Ctrl+S).
 * 5. Coba ubah salah satu nama atau komoditas di baris 2-10 di Sheets Anda.
 *    Perubahan akan otomatis terkirim dan tersinkronisasi ke TaniAI!
 */

function onEdit(e) {
  if (!e || !e.range) return;
  
  var sheet = e.source.getActiveSheet();
  var range = e.range;
  var row = range.getRow();
  var col = range.getColumn();
  var newValue = e.value !== undefined ? e.value : range.getValue();
  
  // Abaikan baris header (baris 1)
  if (row < 2) return;
  
  var webhookUrl = "${sheetsWebhookUrl}";
  
  var payload = {
    event: "sheet_edit",
    sheetName: sheet.getName(),
    row: row,
    col: col,
    value: newValue,
    timestamp: new Date().toISOString()
  };
  
  var options = {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };
  
  try {
    var response = UrlFetchApp.fetch(webhookUrl, options);
    Logger.log("TaniAI Webhook Response: " + response.getContentText());
  } catch (err) {
    Logger.log("Gagal sinkron ke TaniAI: " + err);
  }
}`;

  const curlTestCommand = `curl -X POST "${whatsappWebhookUrl}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "changes": [{
        "value": {
          "messages": [{
            "from": "628123456789",
            "text": { "body": "Halo Kang Tani, saya Pak Budi Karawang lahan 1 Ha padi mau daftar" }
          }]
        }
      }]
    }]
  }'`;

  const copyToClipboard = (text: string, setter: (val: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setter(true);
    setTimeout(() => setter(false), 2500);
  };

  const handleTestPing = async () => {
    setIsPinging(true);
    try {
      const res = await fetch('/api/webhook/test-ping', { method: 'POST' });
      const data = await res.json();
      setPingResult(data);
      fetchLogs();
    } catch (err: any) {
      setPingResult({
        ok: false,
        message: 'Koneksi ping gagal: ' + err.message,
        timestamp: new Date().toLocaleTimeString(),
      });
    } finally {
      setIsPinging(false);
    }
  };

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/webhook/logs');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch webhook logs:', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden my-6 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h3 className="font-bold text-base">Pusat Integrasi Webhook & Sinkronisasi 2-Arah</h3>
              <p className="text-xs text-slate-400">Google Apps Script onEdit & Meta WhatsApp Cloud API</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Bar */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-4 pt-2 shrink-0">
          <button
            onClick={() => setActiveTab('appscript')}
            className={`px-4 py-2 text-xs font-bold flex items-center space-x-2 border-b-2 transition cursor-pointer ${
              activeTab === 'appscript'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Google Apps Script onEdit (2-Way Sync)</span>
          </button>
          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`px-4 py-2 text-xs font-bold flex items-center space-x-2 border-b-2 transition cursor-pointer ${
              activeTab === 'whatsapp'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-600" />
            <span>WhatsApp Meta Cloud API</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700 overflow-y-auto flex-1">
          {activeTab === 'appscript' ? (
            <div className="space-y-4">
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 text-emerald-950 space-y-2">
                <div className="flex items-center space-x-2 font-bold text-xs text-emerald-900">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Mekanisme Sinkronisasi 2-Arah (Google Sheets ⇄ TaniAI)</span>
                </div>
                <p className="text-[11px] leading-relaxed text-emerald-800">
                  Dengan memasang skrip <code>onEdit(e)</code> di bawah, setiap kali petugas atau admin mengubah nilai
                  nama, status verifikasi, atau luasan lahan langsung di lembar kerja Google Sheets, Google Apps Script akan
                  langsung menembak endpoint Webhook TaniAI dan memperbarui database serta disk lokal secara instan.
                </p>
              </div>

              {/* Endpoint URL & Test Ping */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
                <label className="font-bold text-slate-800 block">Endpoint Webhook Target:</label>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    readOnly
                    value={sheetsWebhookUrl}
                    className="flex-1 bg-white border border-slate-300 font-mono text-xs px-3 py-2 rounded-lg text-slate-800"
                  />
                  <button
                    onClick={() => copyToClipboard(sheetsWebhookUrl, setCopiedUrl)}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg flex items-center space-x-1 transition cursor-pointer"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? 'Tersalin' : 'Salin URL'}</span>
                  </button>
                  <button
                    onClick={handleTestPing}
                    disabled={isPinging}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center space-x-1.5 transition cursor-pointer disabled:opacity-50"
                  >
                    <Activity className={`w-3.5 h-3.5 ${isPinging ? 'animate-spin' : ''}`} />
                    <span>{isPinging ? 'Memeriksa...' : 'Uji Ping Webhook'}</span>
                  </button>
                </div>

                {pingResult && (
                  <div
                    className={`mt-2 p-2.5 rounded-lg border text-[11px] flex items-start space-x-2 ${
                      pingResult.ok
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">{pingResult.message}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">Waktu respon: {pingResult.timestamp}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Ready-to-paste Google Apps Script code */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Kode Google Apps Script (Siap Tempel di Extensions &gt; Apps Script):</span>
                  </label>
                  <button
                    onClick={() => copyToClipboard(appsScriptCode, setCopiedScript)}
                    className="text-xs text-emerald-700 hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? 'Kode Tersalin!' : 'Salin Seluruh Skrip'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-emerald-400 p-3.5 rounded-xl font-mono text-[10.5px] overflow-x-auto border border-slate-800 max-h-56 leading-relaxed">
                  {appsScriptCode}
                </pre>
              </div>

              {/* Webhook Activity Logs */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Activity className="w-3.5 h-3.5 text-slate-600" />
                    <span>Log Aktivitas Webhook Masuk (Audit Real-Time)</span>
                  </span>
                  <button
                    onClick={fetchLogs}
                    disabled={loadingLogs}
                    className="text-[11px] text-slate-500 hover:text-slate-800 flex items-center space-x-1 cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${loadingLogs ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                  </button>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 max-h-36 overflow-y-auto space-y-1.5">
                  {logs.length === 0 ? (
                    <p className="text-[11px] text-slate-400 text-center py-3">Belum ada event webhook masuk.</p>
                  ) : (
                    logs.slice(0, 10).map((item) => (
                      <div
                        key={item.id}
                        className="bg-white border border-slate-200 p-2 rounded-lg text-[11px] flex justify-between items-start space-x-2"
                      >
                        <div>
                          <div className="flex items-center space-x-1.5">
                            <span className="font-bold font-mono text-emerald-700 uppercase">{item.event}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-mono">
                              {item.status}
                            </span>
                          </div>
                          <p className="text-slate-600 mt-0.5">{item.detail}</p>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">{item.timestamp}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-slate-600 leading-relaxed">
                Sistem TaniAI telah dilengkapi endpoint <strong>Webhook aktif</strong> standar Meta WhatsApp Cloud API.
                Bapak/Ibu dapat menghubungkannya ke nomor WhatsApp Business resmi atau mencoba simulator di aplikasi.
              </p>

              {/* Callback URL & Verify Token */}
              <div className="space-y-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1">1. Callback URL Webhook:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={whatsappWebhookUrl}
                      className="flex-1 bg-slate-50 border border-slate-300 font-mono text-xs px-3 py-2 rounded-lg text-slate-800"
                    />
                    <button
                      onClick={() => copyToClipboard(whatsappWebhookUrl, setCopiedUrl)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center space-x-1 transition cursor-pointer"
                    >
                      {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedUrl ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1">2. Verify Token:</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      readOnly
                      value={verifyToken}
                      className="flex-1 bg-slate-50 border border-slate-300 font-mono text-xs px-3 py-2 rounded-lg text-slate-800"
                    />
                    <button
                      onClick={() => copyToClipboard(verifyToken, setCopiedToken)}
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg flex items-center space-x-1 transition cursor-pointer"
                    >
                      {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedToken ? 'Tersalin' : 'Salin'}</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Verification Steps */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 space-y-2 text-emerald-900">
                <div className="font-bold flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-700" />
                  <span>Cara Menghubungkan di Meta for Developers:</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-800 pl-1">
                  <li>Buka Meta App Dashboard &gt; Pilih produk <strong>WhatsApp</strong> &gt; <strong>Configuration</strong>.</li>
                  <li>Klik <strong>Edit Webhook</strong>, tempelkan Callback URL dan Verify Token di atas.</li>
                  <li>Klik <strong>Verify and Save</strong> (Server akan membalas challenge secara otomatis).</li>
                  <li>Centang opsi subscription <strong>messages</strong>.</li>
                </ol>
              </div>

              {/* cURL Test Terminal */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-bold text-slate-800 flex items-center space-x-1.5">
                    <Terminal className="w-3.5 h-3.5 text-slate-500" />
                    <span>Uji Coba Kirim Pesan via Terminal (cURL):</span>
                  </label>
                  <button
                    onClick={() => copyToClipboard(curlTestCommand, setCopiedCurl)}
                    className="text-[11px] text-emerald-700 hover:underline flex items-center space-x-1 font-semibold cursor-pointer"
                  >
                    {copiedCurl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedCurl ? 'cURL Tersalin' : 'Salin cURL'}</span>
                  </button>
                </div>
                <pre className="bg-slate-900 text-slate-100 p-3 rounded-xl font-mono text-[10px] overflow-x-auto border border-slate-800">
                  {curlTestCommand}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          <span className="text-[11px] text-slate-500">
            {activeTab === 'appscript' ? 'Aktif menerima trigger onEdit Google Apps Script' : 'Terhubung ke Meta Graph API'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
