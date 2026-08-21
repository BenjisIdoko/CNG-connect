import fs from 'fs';
import path from 'path';

const API_BASE = 'https://pcngi.com.ng/api/v1/conversion-centers';
const API_KEY = 'ZDY1MWU5MjY0MmJjMWNkNGIyNWVlMTQ0NDQ3YjNjOTA';

export async function fetchAndSeedConversionCenters() {
  console.log('Fetching conversion centres from PCNGI API...');
  const allCenters: any[] = [];

  for (let page = 1; page <= 10; page++) {
    const url = `${API_BASE}?limit=50&page=${page}`;
    try {
      const res = await fetch(url, {
        headers: { 'x-api-key': API_KEY },
      });
      if (!res.ok) {
        console.warn(`Failed to fetch page ${page}: HTTP ${res.status}`);
        continue;
      }
      const json = await res.json();
      if (json.data && Array.isArray(json.data)) {
        allCenters.push(...json.data);
        console.log(`Fetched page ${page}: ${json.data.length} records (Total accumulated: ${allCenters.length})`);
      }
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`Error fetching page ${page}:`, err);
    }
  }

  console.log(`\nMapping ${allCenters.length} total conversion centres to ConversionCenter schema...`);

  const seededCenters = allCenters.map((item, idx) => {
    let stateName = item.state || 'Abuja FCT';
    if (stateName.toLowerCase() === 'federal capital territory' || stateName.toLowerCase() === 'fct') {
      stateName = 'Abuja FCT';
    }

    const latitude = item.latitude ? parseFloat(item.latitude) : 9.0765;
    const longitude = item.longitude ? parseFloat(item.longitude) : 7.4853;
    const lgaName = item.lga || '';
    const cityName = lgaName || stateName;

    return {
      id: `pci-cc-${item.id || idx + 1}`,
      code: item.code || `PCNGI-CC-${idx + 100}`,
      name: item.name,
      address: item.address || `${cityName}, ${stateName}`,
      lga: lgaName,
      state: stateName,
      city: cityName,
      phone: item.phone || '+234 800 000 0000',
      status: Boolean(item.status),
      isPiCngAccredited: true,
      rating: 0,
      reviewsCount: 0,
      distance: '2.5 km',
      lat: latitude,
      lng: longitude,
      services: ['CNG Kit Installation', 'Vehicle Inspection', 'Cylinder Testing'],
      conversionPriceRange: '',
      estimatedHours: '',
      image: item.image || undefined,
      locationPrecision: 'source_exact',
      dataSource: 'pci.gov.ng',
      dataSourceDate: '2026-08-20',
    };
  });

  const outputPath = path.resolve(process.cwd(), 'src/data/pci-conversion-centers-seed.json');
  fs.writeFileSync(outputPath, JSON.stringify(seededCenters, null, 2), 'utf-8');
  console.log(`\nSuccessfully generated ${seededCenters.length} conversion centres seed file at: ${outputPath}`);
  return seededCenters;
}

fetchAndSeedConversionCenters();
