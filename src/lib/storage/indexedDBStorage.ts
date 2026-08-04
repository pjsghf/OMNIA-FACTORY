import { BookProject } from '../../types';

const DB_NAME = 'OmniaFactoryDB';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB não suportado neste ambiente.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProjectDB(project: BookProject): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put({
        ...project,
        lastModified: new Date().toISOString(),
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    // Fallback gracefully if IndexedDB is blocked or unavailable
    console.warn(
      '[IndexedDB Storage Warning]: Falha ao salvar no IndexedDB, usando localStorage:',
      err
    );
    try {
      const stored = JSON.parse(localStorage.getItem('omnia_factory_projects_v2') || '[]');
      const index = stored.findIndex((p: any) => p.id === project.id);
      if (index >= 0) {
        stored[index] = project;
      } else {
        stored.unshift(project);
      }
      localStorage.setItem('omnia_factory_projects_v2', JSON.stringify(stored));
    } catch (e) {
      console.error('[LocalStorage Fallback Error]:', e);
    }
  }
}

export async function loadProjectDB(id: string): Promise<BookProject | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB Storage Warning]: Falha ao carregar projeto do IndexedDB:', err);
    return null;
  }
}

export async function getAllProjectsDB(): Promise<BookProject[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn(
      '[IndexedDB Storage Warning]: Falha ao listar projetos do IndexedDB, recorrendo ao localStorage:',
      err
    );
    try {
      return JSON.parse(localStorage.getItem('omnia_factory_projects_v2') || '[]');
    } catch {
      return [];
    }
  }
}

export async function deleteProjectDB(id: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB Storage Warning]: Falha ao deletar do IndexedDB:', err);
  }
}

export async function migrateLocalStorageToIndexedDB(): Promise<number> {
  try {
    const raw = localStorage.getItem('scriptor_projects_v2');
    if (!raw) return 0;

    const legacyProjects: BookProject[] = JSON.parse(raw);
    if (!Array.isArray(legacyProjects) || legacyProjects.length === 0) return 0;

    for (const proj of legacyProjects) {
      await saveProjectDB(proj);
    }

    console.log(
      `[IndexedDB Storage]: ${legacyProjects.length} projeto(s) migrado(s) do localStorage para IndexedDB com sucesso.`
    );
    return legacyProjects.length;
  } catch (err) {
    console.error('[IndexedDB Storage Migration Error]:', err);
    return 0;
  }
}
