import { describe, expect, test, beforeEach } from 'bun:test';
import { CounterStorageService } from '@/services/counter-storage';

describe('Fase 4: Persistência Local de Balcão e Privacidade (CounterStorageService)', () => {
  let service: CounterStorageService;

  beforeEach(() => {
    service = new CounterStorageService();
    service.clearAll();
  });

  test('1. Favoritos de Balcão: adiciona, verifica e remove favoritos sem duplicatas', () => {
    expect(service.getFavorites()).toHaveLength(0);
    expect(service.isFavorite('fam-vw-gol')).toBe(false);

    const afterAdd1 = service.toggleFavorite('fam-vw-gol', 'Volkswagen Gol');
    expect(afterAdd1).toHaveLength(1);
    expect(afterAdd1[0]!.familyId).toBe('fam-vw-gol');
    expect(service.isFavorite('fam-vw-gol')).toBe(true);

    const afterAdd2 = service.toggleFavorite('fam-chevrolet-onix', 'Chevrolet Onix');
    expect(afterAdd2).toHaveLength(2);
    expect(afterAdd2[0]!.familyId).toBe('fam-chevrolet-onix');

    // Toggle novamente remove o favorito
    const afterRemove = service.toggleFavorite('fam-vw-gol', 'Volkswagen Gol');
    expect(afterRemove).toHaveLength(1);
    expect(service.isFavorite('fam-vw-gol')).toBe(false);
    expect(service.isFavorite('fam-chevrolet-onix')).toBe(true);
  });

  test('2. Histórico de Buscas Recentes: deduplica case-insensitive e respeita limite de 10', () => {
    service.addRecentSearch('Gol 2010');
    service.addRecentSearch('Onix 2020');
    service.addRecentSearch('gol 2010'); // deve ir para o topo sem duplicar

    const recent = service.getRecentSearches();
    expect(recent).toEqual(['gol 2010', 'Onix 2020']);

    for (let i = 1; i <= 12; i++) {
      service.addRecentSearch(`Busca Teste ${i}`);
    }
    expect(service.getRecentSearches()).toHaveLength(10);

    service.clearRecentSearches();
    expect(service.getRecentSearches()).toHaveLength(0);
  });

  test('3. Notas Internas de Balcão: salva, atualiza e remove quando vazio', () => {
    expect(service.getVehicleNote('fam-vw-gol')).toBeNull();

    service.setVehicleNote('fam-vw-gol', 'Volkswagen Gol', 'Prateleira B2 - Cliente João');
    const note = service.getVehicleNote('fam-vw-gol');
    expect(note).not.toBeNull();
    expect(note?.text).toBe('Prateleira B2 - Cliente João');

    // Limpar texto remove a nota
    service.setVehicleNote('fam-vw-gol', 'Volkswagen Gol', '   ');
    expect(service.getVehicleNote('fam-vw-gol')).toBeNull();
  });

  test('4. Exportação e Importação de Backup JSON: preserva e mescla dados locais', () => {
    service.toggleFavorite('fam-toyota-hilux', 'Toyota Hilux');
    service.addRecentSearch('24/14');
    service.setVehicleNote('fam-toyota-hilux', 'Toyota Hilux', 'Verificar se é Cabine Dupla');

    const exportedJson = service.exportBackupJson();
    expect(exportedJson).toContain('Toyota Hilux');
    expect(exportedJson).toContain('Verificar se é Cabine Dupla');

    // Novo serviço limpo importa o backup
    const restoredService = new CounterStorageService();
    restoredService.clearAll();
    const summary = restoredService.importBackupJson(exportedJson);

    expect(summary.favoritesCount).toBe(1);
    expect(summary.notesCount).toBe(1);
    expect(summary.recentSearchesCount).toBe(1);
    expect(restoredService.isFavorite('fam-toyota-hilux')).toBe(true);
    expect(restoredService.getVehicleNote('fam-toyota-hilux')?.text).toBe(
      'Verificar se é Cabine Dupla',
    );
  });
});
