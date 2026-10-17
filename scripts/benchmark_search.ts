import { CatalogService } from '../src/services/catalog-service';
import datasetRaw from '../data/validated/dataset.json';
import type { CatalogDataset } from '../src/domain/types';

async function runBenchmark() {
  console.log('=== BENCHMARK DE PERFORMANCE — FASE 6 ===\n');

  const dataset = datasetRaw as unknown as CatalogDataset;
  const service = CatalogService.getInstance();
  await service.initialize(dataset);

  const testQueries = ['HILUX', 'ONIX', 'COROLLA', 'HB20', 'GOL', 'SW4'];
  const resultsTable: Array<{
    query: string;
    runs: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    resultsCount: number;
    familiesCount: number;
  }> = [];

  // Warmup
  for (const q of testQueries) {
    service.search(q);
  }

  // 1. Medição por consulta individual (50 iterações cada)
  for (const query of testQueries) {
    const times: number[] = [];
    let lastResultsCount = 0;
    let lastFamiliesCount = 0;

    for (let i = 0; i < 50; i++) {
      const start = performance.now();
      const res = service.search(query);
      const elapsed = performance.now() - start;
      times.push(elapsed);
      if (i === 0) {
        lastResultsCount = res.length;
        lastFamiliesCount = res.filter((r) => r.type === 'vehicle_family').length;
      }
    }

    const avg = times.reduce((a, b) => a + b, 0) / times.length;
    const min = Math.min(...times);
    const max = Math.max(...times);

    resultsTable.push({
      query,
      runs: times.length,
      avgMs: Number(avg.toFixed(2)),
      minMs: Number(min.toFixed(2)),
      maxMs: Number(max.toFixed(2)),
      resultsCount: lastResultsCount,
      familiesCount: lastFamiliesCount,
    });
  }

  console.table(resultsTable);

  // 2. Teste de Resistência e Estresse de Memória: 100 buscas consecutivas
  console.log('\nExecutando teste de estresse com 100 buscas consecutivas alternadas...');
  const stressQueries = [
    'HILUX', 'ONIX', 'COROLLA', 'HB20', 'GOL', 'SW4',
    'HILUX 2015', 'HILUX 2016', 'ONIX PLUS', 'COROLLA CROSS',
    'HB20S', 'GOLF', 'KA', 'KADETT', 'SD6', 'YN-PS2416B'
  ];

  const memStart = process.memoryUsage().heapUsed;
  const stressTimes: number[] = [];

  for (let i = 0; i < 100; i++) {
    const q = stressQueries[i % stressQueries.length]!;
    const start = performance.now();
    const res = service.search(q);
    const elapsed = performance.now() - start;
    stressTimes.push(elapsed);
    if (!res) throw new Error(`Falha na busca ${q}`);
  }

  const memEnd = process.memoryUsage().heapUsed;
  const memDiffMb = ((memEnd - memStart) / (1024 * 1024)).toFixed(2);
  const avgStress = (stressTimes.reduce((a, b) => a + b, 0) / stressTimes.length).toFixed(2);
  const maxStress = Math.max(...stressTimes).toFixed(2);

  console.log(`- 100 buscas concluídas com sucesso.`);
  console.log(`- Tempo médio no estresse: ${avgStress} ms`);
  console.log(`- Maior tempo no estresse: ${maxStress} ms`);
  console.log(`- Variação de memória heap: ${memDiffMb} MB`);

  console.log('\n=== BENCHMARK CONCLUÍDO ===');
}

runBenchmark().catch(console.error);
