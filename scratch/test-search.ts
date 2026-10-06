import { CatalogService } from '../src/services/catalog-service';
import type { CatalogDataset } from '../src/domain/types';
import { cleanVehicleModelFamily } from '../src/domain/consolidation';

async function run() {
  const dataset: CatalogDataset = JSON.parse(await Bun.file('data/validated/dataset.json').text());
  const service = CatalogService.getInstance();
  await service.initialize(dataset);

  const testQueries = ['HILUX', 'ETIOS', 'GOL', 'GOLF', 'COROLLA', 'ONIX', 'PALIO'];

  for (const q of testQueries) {
    const items = service.search(q);
    console.log(`\n=================== BUSCA: "${q}" (Total: ${items.length} quadros) ===================`);
    items.forEach((item, i) => {
      if (item.type === 'vehicle' && item.vehicle) {
        const v = item.vehicle;
        const apps = item.matchedApplications?.map(a => `${a.application.position} (${a.fits.map(f => f.manufacturerCode).join(',')})`).join(' | ');
        console.log(`  #${i + 1}: [${v.brand}] ${v.model} | Ano: ${v.yearRaw} (${v.yearStart}-${v.yearEnd})`);
        console.log(`       Posições: ${apps}`);
      } else {
        console.log(`  #${i + 1}: [Produto] ${item.product?.code}`);
      }
    });
  }
}
run();
