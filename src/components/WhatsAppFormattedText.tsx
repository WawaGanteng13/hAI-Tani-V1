import React from 'react';
import { ExternalLink, Download } from 'lucide-react';

interface Props {
  text: string;
}

export const WhatsAppFormattedText: React.FC<Props> = ({ text }) => {
  // Split lines to preserve newlines and bullet points
  const lines = text.split('\n');

  return (
    <div className="space-y-1 text-inherit">
      {lines.map((line, lineIdx) => {
        // Empty lines create a slight vertical break
        if (!line.trim()) {
          return <div key={lineIdx} className="h-2" />;
        }

        return (
          <div key={lineIdx} className="leading-relaxed break-words">
            {formatLine(line)}
          </div>
        );
      })}
    </div>
  );
};

// Formats inline tokens (*bold*, _italic_, ~strikethrough~, and links)
function formatLine(line: string): React.ReactNode[] {
  // Regex to match:
  // 1. /api/sheets/export.csv or /api/sheets/live-view or URLs
  // 2. *bold*
  // 3. _italic_
  // 4. ~strike~
  const tokenRegex = /(\/api\/sheets\/[a-zA-Z0-9._-]+|https?:\/\/[^\s)]+|\*[^*]+\*|_[^_]+_|~[^~]+~)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.substring(lastIndex, match.index));
    }

    const token = match[0];

    if (token.startsWith('*') && token.endsWith('*') && token.length > 2) {
      parts.push(
        <strong key={match.index} className="font-bold text-slate-900">
          {token.slice(1, -1)}
        </strong>
      );
    } else if (token.startsWith('_') && token.endsWith('_') && token.length > 2) {
      parts.push(
        <em key={match.index} className="italic text-slate-700">
          {token.slice(1, -1)}
        </em>
      );
    } else if (token.startsWith('~') && token.endsWith('~') && token.length > 2) {
      parts.push(
        <span key={match.index} className="line-through text-slate-500">
          {token.slice(1, -1)}
        </span>
      );
    } else if (token === '/api/sheets/export.csv') {
      parts.push(
        <a
          key={match.index}
          href="/api/sheets/export.csv"
          download
          className="inline-flex items-center space-x-1 font-semibold text-emerald-800 hover:text-emerald-950 bg-emerald-100/90 hover:bg-emerald-200 px-2 py-0.5 rounded border border-emerald-300 transition text-xs mx-1"
        >
          <Download className="w-3 h-3" />
          <span>Unduh File CSV</span>
        </a>
      );
    } else if (token === '/api/sheets/live-view') {
      parts.push(
        <a
          key={match.index}
          href="/api/sheets/live-view"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 font-semibold text-sky-800 hover:text-sky-950 bg-sky-100/90 hover:bg-sky-200 px-2 py-0.5 rounded border border-sky-300 transition text-xs mx-1"
        >
          <ExternalLink className="w-3 h-3" />
          <span>Buka Live Sheets</span>
        </a>
      );
    } else if (token.startsWith('http://') || token.startsWith('https://')) {
      parts.push(
        <a
          key={match.index}
          href={token}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center space-x-1 font-medium text-emerald-700 underline hover:text-emerald-900 mx-0.5 break-all"
        >
          <span>{token}</span>
          <ExternalLink className="w-3 h-3 inline" />
        </a>
      );
    } else {
      parts.push(token);
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.substring(lastIndex));
  }

  return parts;
}
