'use client';

import { useState } from 'react';
import { Users, Copy, Check, X, Link, LogOut } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface CollabState {
  active: boolean;
  roomId: string | null;
  peers: number;
  connected: boolean;
}

interface Props {
  collab: CollabState;
  onCreateRoom: () => string;
  onJoinRoom: (roomId: string) => void;
  onStop: () => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CollaborationPanel({
  collab,
  onCreateRoom,
  onJoinRoom,
  onStop,
  onClose,
}: Props) {
  const [joinInput, setJoinInput] = useState('');
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    onCreateRoom();
  };

  const handleJoin = () => {
    const id = joinInput.trim();
    if (!id) return;
    onJoinRoom(id);
    setJoinInput('');
  };

  const copyRoom = async () => {
    if (!collab.roomId) return;
    await navigator.clipboard.writeText(collab.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--parchment)] p-4 shadow-lg">

      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--teal)]" />
          <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--teal)]">
            Colaboração em tempo real
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[var(--faint)] transition hover:text-[var(--muted)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!collab.active ? (
        /* ── INACTIVE: create or join ── */
        <div className="space-y-3">
          <p className="font-mono text-[11px] leading-[1.6] text-[var(--muted)]">
            Partilha o documento com outros editores em tempo real via WebRTC.
            Sem servidor — ligação directa entre navegadores.
          </p>

          <button
            type="button"
            onClick={handleCreate}
            className="flex w-full items-center justify-center gap-2 rounded border border-[var(--teal)]/40 bg-[var(--teal)]/10 py-2.5 font-mono text-[11px] text-[var(--teal)] transition hover:bg-[var(--teal)]/15"
          >
            <Users className="h-3.5 w-3.5" />
            Criar sala de colaboração
          </button>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-[var(--border)]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-[var(--faint)]">ou</span>
            <div className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="flex gap-2">
            <input
              value={joinInput}
              onChange={e => setJoinInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleJoin()}
              placeholder="ID da sala · ex: muneri-a3b4c5d6"
              className="flex-1 rounded border border-[var(--border)] bg-transparent px-3 py-1.5 font-mono text-[11px] text-[var(--ink)] outline-none placeholder-[var(--faint)] focus:border-[var(--teal)]"
            />
            <button
              type="button"
              onClick={handleJoin}
              disabled={!joinInput.trim()}
              className="flex items-center gap-1.5 rounded border border-[var(--border)] px-3 py-1.5 font-mono text-[11px] text-[var(--muted)] transition hover:border-[var(--teal)] hover:text-[var(--teal)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Link className="h-3.5 w-3.5" />
              Entrar
            </button>
          </div>
        </div>
      ) : (
        /* ── ACTIVE: room info ── */
        <div className="space-y-3">
          {/* Status */}
          <div className="flex items-center gap-2 rounded border border-[var(--teal)]/30 bg-[var(--teal)]/10 px-3 py-2">
            <span
              className={`h-2 w-2 rounded-full ${
                collab.connected
                  ? 'bg-[var(--teal)] shadow-[0_0_5px_var(--teal)]'
                  : 'bg-[var(--faint)]'
              }`}
            />
            <span className="font-mono text-[11px] text-[var(--teal)]">
              {collab.connected
                ? `${collab.peers} editor(es) online`
                : 'A ligar…'}
            </span>
          </div>

          {/* Room ID */}
          <div>
            <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--faint)]">
              ID da sala — partilha com outros editores
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded border border-[var(--border)] bg-[var(--border)]/20 px-3 py-1.5 font-mono text-[11px] text-[var(--muted)]">
                {collab.roomId}
              </code>
              <button
                type="button"
                onClick={copyRoom}
                title="Copiar ID"
                className="flex h-8 w-8 items-center justify-center rounded border border-[var(--border)] text-[var(--faint)] transition hover:border-[var(--gold2)] hover:text-[var(--gold2)]"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-[var(--teal)]" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          </div>

          {/* Stop */}
          <button
            type="button"
            onClick={onStop}
            className="flex w-full items-center justify-center gap-2 rounded border border-red-500/30 bg-red-500/10 py-2 font-mono text-[11px] text-red-400 transition hover:bg-red-500/15"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair da colaboração
          </button>
        </div>
      )}

      <p className="mt-3 font-mono text-[9px] leading-[1.5] text-[var(--faint)]">
        A colaboração usa WebRTC P2P via y-webrtc. Os dados passam directamente
        entre os navegadores sem servidor intermédio.
      </p>
    </div>
  );
}
