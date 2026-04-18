'use client';

// src/hooks/useCoverFormPersistence.ts
//
// Persiste os dados do formulário de capa/contracapa no IndexedDB.
// O formulário é longo (instituição, delegação, logo, curso, disciplina,
// tema, grupo, membros, docente, cidade, data) e o utilizador perde
// tudo ao fechar o modal acidentalmente.
//
// DESIGN:
//  • Uma única "store" IndexedDB chamada "muneri" com a key "cover_form_draft"
//  • Escrita debounced (300ms) para não bloquear o render em cada keystroke
//  • Leitura assíncrona no mount — o formulário começa com INITIAL e
//    actualiza assim que o draft é lido do IDB
//  • clearDraft() chamado após submissão bem-sucedida
//  • Fallback silencioso se o browser não suportar IDB (private mode Safari, etc.)

import { useCallback, useEffect, useRef, useState } from 'react';

// ── Tipo do formulário (espelha FormState em CoverFormModal) ─────────────────

export interface CoverFormDraft {
  institution:   string;
  delegation:    string;
  logoBase64:    string;
  logoMediaType: 'image/png' | 'image/jpeg' | '';
  course:        string;
  subject:       string;
  theme:         string;
  group:         string;
  members:       string[];
  teacher:       string;
  city:          string;
  date:          string;
}

export const COVER_FORM_INITIAL: CoverFormDraft = {
  institution:   '',
  delegation:    '',
  logoBase64:    '',
  logoMediaType: '',
  course:        '',
  subject:       '',
  theme:         '',
  group:         '',
  members:       [''],
  teacher:       '',
  city:          '',
  date:          '',
};

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

const DB_NAME    = 'muneri-cover';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const DRAFT_KEY  = 'cover_form_draft';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

async function idbGet(key: string): Promise<CoverFormDraft | null> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE_NAME, 'readonly');
      const store   = tx.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror   = () => reject(request.error);
      tx.oncomplete     = () => db.close();
    });
  } catch {
    return null; // IDB indisponível (private mode, etc.)
  }
}

async function idbSet(key: string, value: CoverFormDraft): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE_NAME, 'readwrite');
      const store   = tx.objectStore(STORE_NAME);
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror   = () => reject(request.error);
      tx.oncomplete     = () => db.close();
    });
  } catch {
    // falha silenciosa
  }
}

async function idbDelete(key: string): Promise<void> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx      = db.transaction(STORE_NAME, 'readwrite');
      const store   = tx.objectStore(STORE_NAME);
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror   = () => reject(request.error);
      tx.oncomplete     = () => db.close();
    });
  } catch {
    // falha silenciosa
  }
}

// ── Hook principal ────────────────────────────────────────────────────────────

export interface UseCoverFormPersistenceReturn {
  /** Dados do formulário (sincronizados com IDB) */
  draft:      CoverFormDraft;
  /** Actualiza um ou vários campos — persiste automaticamente */
  setField:   <K extends keyof CoverFormDraft>(key: K, value: CoverFormDraft[K]) => void;
  /** true enquanto o draft do IDB ainda não foi lido */
  loading:    boolean;
  /** Apaga o draft do IDB (chamar após submissão bem-sucedida) */
  clearDraft: () => Promise<void>;
  /** true se existe um draft guardado (útil para mostrar badge "rascunho guardado") */
  hasDraft:   boolean;
}

export function useCoverFormPersistence(): UseCoverFormPersistenceReturn {
  const [draft,   setDraft]   = useState<CoverFormDraft>(COVER_FORM_INITIAL);
  const [loading, setLoading] = useState(true);
  const [hasDraft, setHasDraft] = useState(false);

  // Ref para o timer de debounce — evita criar um novo em cada render
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref para o valor mais recente — usado dentro do callback de debounce
  const latestDraftRef = useRef<CoverFormDraft>(draft);

  // ── Ler draft do IDB no mount ─────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    idbGet(DRAFT_KEY).then((saved) => {
      if (cancelled) return;
      if (saved) {
        setDraft(saved);
        latestDraftRef.current = saved;
        setHasDraft(true);
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  // ── Actualizar campo e agendar persistência ───────────────────────────────
  const setField = useCallback(<K extends keyof CoverFormDraft>(
    key: K,
    value: CoverFormDraft[K],
  ) => {
    setDraft(prev => {
      const next = { ...prev, [key]: value };
      latestDraftRef.current = next;

      // Debounce: escreve no IDB 300ms após a última alteração
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void idbSet(DRAFT_KEY, latestDraftRef.current);
        setHasDraft(true);
      }, 300);

      return next;
    });
  }, []);

  // ── Limpar draft após submissão ───────────────────────────────────────────
  const clearDraft = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await idbDelete(DRAFT_KEY);
    setDraft(COVER_FORM_INITIAL);
    latestDraftRef.current = COVER_FORM_INITIAL;
    setHasDraft(false);
  }, []);

  // ── Cleanup do debounce ao desmontar ──────────────────────────────────────
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return { draft, setField, loading, clearDraft, hasDraft };
}
