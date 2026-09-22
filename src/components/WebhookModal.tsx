import React, { useState } from 'react';
import { X, Copy, Check, Radio, ExternalLink, Terminal, ShieldCheck, CheckCircle2 } from 'lucide-react';

interface WebhookModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WebhookModal: React.FC<WebhookModalProps> = ({ isOpen, onClose }) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedCurl, setCopiedCurl] = useState(false);

  if (!isOpen) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const webhookUrl = `${currentOrigin}/api/webhook/whatsapp`;
  const verifyToken = 'tani_ai_webhook_verify_token';

  const curlTestCommand = `curl -X POST "${webhookUrl}" \\
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-bold text-base">Panduan Integrasi WhatsApp Business Webhook</h3>
              <p className="text-xs text-slate-400">Meta Cloud API / Twilio WhatsApp Connection</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-xs text-slate-700">
          <p className="text-slate-600 leading-relaxed">
            Sistem TaniAI telah dilengkapi endpoint <strong>Webhook aktif</strong> standar Meta WhatsApp Cloud API. Bapak/Ibu dapat menghubungkannya ke nomor WhatsApp Business resmi atau mencoba simulator di aplikasi.
          </p>

          {/* Callback URL & Verify Token */}
          <div className="space-y-3">
            <div>
              <label className="font-bold text-slate-800 block mb-1">1. Callback URL Webhook:</label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={webhookUrl}
                  className="flex-1 bg-slate-50 border border-slate-300 font-mono text-xs px-3 py-2 rounded-lg text-slate-800"
                />
                <button
                  onClick={() => copyToClipboard(webhookUrl, setCopiedUrl)}
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

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
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
