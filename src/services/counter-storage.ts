/**
 * Serviço de Persistência Local de Balcão (Offline-First / 100% Privado na Máquina Local).
 *
 * Gerencia:
 *  - Favoritos / Veículos Mais Vendidos no Balcão
 *  - Histórico de Buscas Recentes
 *  - Notas / Observações Internas do Balconista por Família de Veículo
 *  - Exportação e Importação de Backup em JSON
 *
 * Nenhum dado deste serviço é enviado para servidores externos ou versionado no Git.
 */

export interface FavoriteVehicleItem {
  familyId: string;
  fullName: string;
  addedAt: string;
}

export interface CounterVehicleNote {
  familyId: string;
  fullName: string;
  text: string;
  updatedAt: string;
}

export interface CounterBackupPayload {
  version: 1;
  exportedAt: string;
  favorites: FavoriteVehicleItem[];
  recentSearches: string[];
  notes: Record<string, CounterVehicleNote>;
}

const STORAGE_KEYS = {
  FAVORITES: 'catalogo_palhetas_counter_favorites_v1',
  RECENT_SEARCHES: 'catalogo_palhetas_recent_searches_v1',
  NOTES: 'catalogo_palhetas_counter_notes_v1',
} as const;

const MAX_RECENT_SEARCHES = 10;

export class CounterStorageService {
  private memoryFallback: {
    favorites: FavoriteVehicleItem[];
    recentSearches: string[];
    notes: Record<string, CounterVehicleNote>;
  } = {
    favorites: [],
    recentSearches: [],
    notes: {},
  };

  private hasLocalStorage(): boolean {
    try {
      return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
    } catch {
      return false;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Favoritos de Balcão                                                 */
  /* ------------------------------------------------------------------ */

  public getFavorites(): FavoriteVehicleItem[] {
    if (!this.hasLocalStorage()) {
      return [...this.memoryFallback.favorites];
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(
        (item): item is FavoriteVehicleItem =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as FavoriteVehicleItem).familyId === 'string' &&
          typeof (item as FavoriteVehicleItem).fullName === 'string',
      );
    } catch {
      return [];
    }
  }

  public isFavorite(familyId: string): boolean {
    return this.getFavorites().some((f) => f.familyId === familyId);
  }

  public toggleFavorite(familyId: string, fullName: string): FavoriteVehicleItem[] {
    const current = this.getFavorites();
    const exists = current.some((f) => f.familyId === familyId);
    const updated = exists
      ? current.filter((f) => f.familyId !== familyId)
      : [{ familyId, fullName, addedAt: new Date().toISOString() }, ...current];

    this.saveFavorites(updated);
    return updated;
  }

  private saveFavorites(favorites: FavoriteVehicleItem[]): void {
    this.memoryFallback.favorites = [...favorites];
    if (!this.hasLocalStorage()) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
    } catch {
      // Ignora erro de quota do localStorage
    }
  }

  /* ------------------------------------------------------------------ */
  /* Histórico de Buscas Recentes                                        */
  /* ------------------------------------------------------------------ */

  public getRecentSearches(): string[] {
    if (!this.hasLocalStorage()) {
      return [...this.memoryFallback.recentSearches];
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.RECENT_SEARCHES);
      if (!raw) return [];
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((q): q is string => typeof q === 'string' && q.trim().length > 0);
    } catch {
      return [];
    }
  }

  public addRecentSearch(query: string): string[] {
    const trimmed = query.trim();
    if (trimmed.length < 2) return this.getRecentSearches();

    const current = this.getRecentSearches();
    const deduplicated = current.filter((q) => q.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...deduplicated].slice(0, MAX_RECENT_SEARCHES);

    this.saveRecentSearches(updated);
    return updated;
  }

  public clearRecentSearches(): string[] {
    this.saveRecentSearches([]);
    return [];
  }

  private saveRecentSearches(searches: string[]): void {
    this.memoryFallback.recentSearches = [...searches];
    if (!this.hasLocalStorage()) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(searches));
    } catch {
      // Ignora erro de quota
    }
  }

  /* ------------------------------------------------------------------ */
  /* Notas / Observações Internas por Veículo                            */
  /* ------------------------------------------------------------------ */

  public getNotes(): Record<string, CounterVehicleNote> {
    if (!this.hasLocalStorage()) {
      return { ...this.memoryFallback.notes };
    }
    try {
      const raw = window.localStorage.getItem(STORAGE_KEYS.NOTES);
      if (!raw) return {};
      const parsed: unknown = JSON.parse(raw);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
      const result: Record<string, CounterVehicleNote> = {};
      for (const [key, val] of Object.entries(parsed)) {
        if (
          typeof val === 'object' &&
          val !== null &&
          typeof (val as CounterVehicleNote).familyId === 'string' &&
          typeof (val as CounterVehicleNote).text === 'string'
        ) {
          result[key] = val as CounterVehicleNote;
        }
      }
      return result;
    } catch {
      return {};
    }
  }

  public getVehicleNote(familyId: string): CounterVehicleNote | null {
    const notes = this.getNotes();
    return notes[familyId] ?? null;
  }

  public setVehicleNote(
    familyId: string,
    fullName: string,
    text: string,
  ): Record<string, CounterVehicleNote> {
    const notes = this.getNotes();
    const trimmed = text.trim();

    if (!trimmed) {
      delete notes[familyId];
    } else {
      notes[familyId] = {
        familyId,
        fullName,
        text: trimmed,
        updatedAt: new Date().toISOString(),
      };
    }

    this.saveNotes(notes);
    return notes;
  }

  private saveNotes(notes: Record<string, CounterVehicleNote>): void {
    this.memoryFallback.notes = { ...notes };
    if (!this.hasLocalStorage()) return;
    try {
      window.localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    } catch {
      // Ignora erro de quota
    }
  }

  /* ------------------------------------------------------------------ */
  /* Exportação e Importação de Backup Local (JSON)                      */
  /* ------------------------------------------------------------------ */

  public exportBackupJson(): string {
    const payload: CounterBackupPayload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      favorites: this.getFavorites(),
      recentSearches: this.getRecentSearches(),
      notes: this.getNotes(),
    };
    return JSON.stringify(payload, null, 2);
  }

  public importBackupJson(rawJson: string): {
    favoritesCount: number;
    notesCount: number;
    recentSearchesCount: number;
  } {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      throw new Error('Arquivo JSON inválido ou corrompido.');
    }

    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Estrutura de backup inválida.');
    }

    const data = parsed as Partial<CounterBackupPayload>;

    // Mescla favoritos preservando existentes sem duplicar
    const currentFavorites = this.getFavorites();
    const incomingFavorites = Array.isArray(data.favorites)
      ? data.favorites.filter(
          (f): f is FavoriteVehicleItem =>
            typeof f === 'object' &&
            f !== null &&
            typeof f.familyId === 'string' &&
            typeof f.fullName === 'string',
        )
      : [];

    const favMap = new Map<string, FavoriteVehicleItem>();
    for (const f of [...incomingFavorites, ...currentFavorites]) {
      if (!favMap.has(f.familyId)) {
        favMap.set(f.familyId, {
          familyId: f.familyId,
          fullName: f.fullName,
          addedAt: f.addedAt || new Date().toISOString(),
        });
      }
    }
    const mergedFavorites = Array.from(favMap.values());
    this.saveFavorites(mergedFavorites);

    // Mescla buscas recentes
    const currentSearches = this.getRecentSearches();
    const incomingSearches = Array.isArray(data.recentSearches)
      ? data.recentSearches.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      : [];
    const mergedSearches = Array.from(new Set([...incomingSearches, ...currentSearches])).slice(
      0,
      MAX_RECENT_SEARCHES,
    );
    this.saveRecentSearches(mergedSearches);

    // Mescla notas de veículos
    const currentNotes = this.getNotes();
    const incomingNotes: Record<string, CounterVehicleNote> = {};
    if (typeof data.notes === 'object' && data.notes !== null && !Array.isArray(data.notes)) {
      for (const [k, v] of Object.entries(data.notes)) {
        if (
          typeof v === 'object' &&
          v !== null &&
          typeof v.familyId === 'string' &&
          typeof v.text === 'string' &&
          v.text.trim().length > 0
        ) {
          incomingNotes[k] = {
            familyId: v.familyId,
            fullName: v.fullName || v.familyId,
            text: v.text.trim(),
            updatedAt: v.updatedAt || new Date().toISOString(),
          };
        }
      }
    }
    const mergedNotes = { ...currentNotes, ...incomingNotes };
    this.saveNotes(mergedNotes);

    return {
      favoritesCount: mergedFavorites.length,
      notesCount: Object.keys(mergedNotes).length,
      recentSearchesCount: mergedSearches.length,
    };
  }

  public clearAll(): void {
    this.saveFavorites([]);
    this.saveRecentSearches([]);
    this.saveNotes({});
  }
}

export const counterStorage = new CounterStorageService();
