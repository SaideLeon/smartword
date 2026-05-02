'use client';

// src/hooks/useRequerimentoFormPersistence.ts
// Persiste os dados do formulário de requerimento no IndexedDB.
// Segue exactamente o mesmo padrão de useCoverFormPersistence.ts.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequerimentoFormDraft } from '@/lib/docx/requerimento-types';
import { REQUERIMENTO_FORM_INITIAL } from '@/lib/docx/requerimento-types';

const DB_NAME    = 'muneri-requerimento';
const DB_VERSION = 1;
const STORE_NAME = 'drafts';
const DRAFT_KEY  = 'requerimento_form_draft';

// ── IndexedDB helpers ─────────────────────────────────────────────────────────

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

async function idbGet(key: string): Promise<RequerimentoFormDraft | null> {
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
    return null;
  }
}

async function idbSet(key: string, value: RequerimentoFormDraft): Promise<void> {
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
  } catch { /* falha silenciosa */ }
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
  } catch { /* falha silenciosa */ }
}

// ── Hook principal ────────────────────────────────────────────────────────────

export interface UseRequerimentoFormPersistenceReturn {
  draft:      RequerimentoFormDraft;
  setField:   <K extends keyof RequerimentoFormDraft>(key: K, value: RequerimentoFormDraft[K]) => void;
  loading:    boolean;
  clearDraft: () => Promise<void>;
  hasDraft:   boolean;
}

export function useRequerimentoFormPersistence(): UseRequerimentoFormPersistenceReturn {
  const [draft,    setDraft]    = useState<RequerimentoFormDraft>(REQUERIMENTO_FORM_INITIAL);
  const [loading,  setLoading]  = useState(true);
  const [hasDraft, setHasDraft] = useState(false);

  const debounceRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDraftRef = useRef<RequerimentoFormDraft>(draft);

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

  const setField = useCallback(<K extends keyof RequerimentoFormDraft>(
    key: K,
    value: RequerimentoFormDraft[K],
  ) => {
    setDraft(prev => {
      const next = { ...prev, [key]: value };
      latestDraftRef.current = next;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void idbSet(DRAFT_KEY, latestDraftRef.current);
        setHasDraft(true);
      }, 300);
      return next;
    });
  }, []);

  const clearDraft = useCallback(async () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    await idbDelete(DRAFT_KEY);
    setDraft(REQUERIMENTO_FORM_INITIAL);
    latestDraftRef.current = REQUERIMENTO_FORM_INITIAL;
    setHasDraft(false);
  }, []);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  return { draft, setField, loading, clearDraft, hasDraft };
}
