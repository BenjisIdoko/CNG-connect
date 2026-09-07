-- Revert every Google-Places pin the enrichment flagged for review to its
-- pre-enrichment PCI centroid. A flagged match (wrong branch, name
-- mismatch, several stations collapsed onto one Place, or a big
-- unverified jump) is less trustworthy than an honest 'approximate'
-- centroid. The unflagged rooftop matches are left intact.

begin;

-- BOVAS CNG - Upper Sakponba  ->  matched "Conoil Filling Station", moved 489m
update stations set lat=6.312, lng=5.641, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='bovas-cng-upper-sakponba';
-- NIPCO Gas Limited - Along NPA Road  ->  matched "NIPCO", moved 39603m
update stations set lat=5.518619, lng=5.74802, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-11';
-- Greenville LNG - Nigeria Prisons Barracks Road  ->  matched "Greenville LNG Gas Station", moved 0m
update stations set lat=6.294842, lng=5.593168, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-14';
-- 11 PLC (NIPCO) - Lagos  ->  matched "NIPCO RETAIL OUTLET", moved 0m
update stations set lat=6.46275, lng=3.849985, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-15';
-- 11 PLC (NIPCO) - Ikeja  ->  matched "NIPCO RETAIL OUTLET", moved 2747m
update stations set lat=6.597473, lng=3.343281, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-16';
-- 11 PLC (NIPCO) - Apapa  ->  matched "Mobil", moved 429m
update stations set lat=6.445187, lng=3.368373, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-17';
-- NIPCO Gas Limited - Avbiama  ->  matched "Nipco CNG Filling Station", moved 2032m
update stations set lat=6.333059, lng=5.622106, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-2';
-- Portland Gas Ltd - Oregun  ->  matched "Portland CNG station", moved 918m
update stations set lat=6.581396, lng=3.369091, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-23';
-- MBH Power Limited (CNG Re-fueling Station) - Ikorodu  ->  matched "PDI CNG PLANT IKORODU", moved 7006m
update stations set lat=6.619123, lng=3.504127, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-25';
-- NNPC Retail - Lagos  ->  matched "NNPC RETAIL", moved 8620m
update stations set lat=6.455057, lng=3.394179, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-26';
-- NNPC Retail - Along Lagos Epe Expressway  ->  matched "NNPC RETAIL", moved 8620m
update stations set lat=6.455057, lng=3.394179, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-27';
-- NIPCO Gas Limited - Textile Mill Road  ->  matched "NIPCO LPG GAS Agbor road", moved 10420m
update stations set lat=6.333059, lng=5.622106, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-3';
-- Gas Network Services Limited / NGML / Axxela - Ilasamaja  ->  matched "NNPC Limited Gas Pipeline", moved 10493m
update stations set lat=6.520465, lng=3.335717, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-31';
-- Tetracore - Ogbere 101241  ->  matched "(no match)", moved 0m
update stations set lat=6.739288, lng=4.161013, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-32';
-- Bovas and Company Ltd - Ajibode Junction  ->  matched "Bovas", moved 1783m
update stations set lat=7.378368, lng=3.897233, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-35';
-- Bovas and Company Ltd - Alakia  ->  matched "Bovas", moved 1783m
update stations set lat=7.378368, lng=3.897233, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-36';
-- Suncontractors - Ota-Agbara Road  ->  matched "(no match)", moved 0m
update stations set lat=6.539248, lng=3.096037, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-37';
-- Vision Gas and Power Ltd - Sagamu Road  ->  matched "(no match)", moved 0m
update stations set lat=6.705851, lng=3.510265, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-38';
-- NIPCO Gas Limited - Agbor Road  ->  matched "NIPCO LPG GAS Agbor road", moved 10420m
update stations set lat=6.333059, lng=5.622106, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-4';
-- Ibile Oil and Gas - Km 44  ->  matched "IBILE Oil and Gas Corporation IOGC", moved 17877m
update stations set lat=6.455057, lng=3.394179, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-40';
-- Ibile Oil and Gas - Oregun  ->  matched "IBILE Oil and Gas Corporation IOGC", moved 3723m
update stations set lat=6.582574, lng=3.375272, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-41';
-- Femadec Energy Limited - Obafemi Awolowo University Primary School  ->  matched "Femadec Gas (CNG) Station Owerri", moved 0m
update stations set lat=7.517618, lng=4.538024, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-42';
-- Greenville LNG - Ilishan II  ->  matched "Greenville LNG Gas Station", moved 33357m
update stations set lat=6.978858, lng=3.438929, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-43';
-- Ibile Oil and Gas - Amuwo Odofin  ->  matched "IBILE Oil and Gas Corporation IOGC", moved 13966m
update stations set lat=6.492087, lng=3.321855, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-44';
-- Femadec Energy Limited - access road  ->  matched "Femadec Gas (CNG) Station Owerri", moved 14145m
update stations set lat=5.384276, lng=6.991206, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-47';
-- Greenville LNG - Zaria Road  ->  matched "GREENVILLE LNG NA'IBAWA FLY OVER KANO", moved 6346m
update stations set lat=11.974034, lng=8.544531, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-49';
-- NIPCO Gas Limited - New Lagos Road  ->  matched "Nipco CNG Filling Station", moved 1877m
update stations set lat=6.353249, lng=5.627451, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-5';
-- Greenville LNG - Batagarawa  ->  matched "GREENVILLE LNG NA'IBAWA FLY OVER KANO", moved 0m
update stations set lat=12.867777, lng=7.53143, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-51';
-- ASAD Energy Fleet - Zaria Road  ->  matched "Asad Energy Fleet Limited, CNG & LNG Gas Station", moved 11270m
update stations set lat=11.974034, lng=8.544531, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-53';
-- ASAD Energy Fleet - Marabar Jos  ->  matched "Asad Energy Fleet Limited, CNG & LNG Gas Station", moved 0m
update stations set lat=10.382532, lng=7.853323, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-54';
-- Greenville LNG - Kano-Zaria Road  ->  matched "GREENVILLE LNG NA'IBAWA FLY OVER KANO", moved 8980m
update stations set lat=11.993998, lng=8.521974, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-55';
-- Greenville LNG - Dan Agundi  ->  matched "GREENVILLE LNG NA'IBAWA FLY OVER KANO", moved 7711m
update stations set lat=11.981323, lng=8.520408, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-56';
-- ASAD Energy Fleet - Opp. Shago Tara  ->  matched "Asad Energy Fleet Limited, CNG & LNG Gas Station", moved 13623m
update stations set lat=11.993998, lng=8.521974, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-57';
-- Greenville LNG - Zaria Road (Dakatsalle Hub)  ->  matched "GREENVILLE LNG NA'IBAWA FLY OVER KANO", moved 6346m
update stations set lat=11.974034, lng=8.544531, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-58';
-- NIPCO Gas Limited - Maitama  ->  matched "Nipco", moved 3528m
update stations set lat=9.080511, lng=7.4969, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-59';
-- NIPCO Gas Limited - Eyaen  ->  matched "Nipco CNG Filling Station", moved 2032m
update stations set lat=6.333059, lng=5.622106, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-6';
-- NIPCO Gas Limited - FCT  ->  matched "Nipco", moved 3382m
update stations set lat=9.064331, lng=7.489297, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-60';
-- Rolling Energy - 26 Ipaye Road, Gra, Ilorin 240101, Kwara, Nigeria  ->  matched "(no match)", moved 0m
update stations set lat=8.487369, lng=4.564477, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-69';
-- NIPCO Gas Limited - Ajaokuta  ->  matched "NNPC Filling Station", moved 4630m
update stations set lat=7.563997, lng=6.629117, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-70';
-- NIPCO Gas Limited - Tungamaje  ->  matched "NIPCO GAS PLANT", moved 3232m
update stations set lat=9.064331, lng=7.489297, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-71';
-- 11 PLC (NIPCO) - Abuja  ->  matched "Nipco", moved 3382m
update stations set lat=9.064331, lng=7.489297, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-72';
-- 11 PLC (NIPCO) - FM Opurum Street  ->  matched "NIPCO GAS PLANT", moved 14342m
update stations set lat=8.964189, lng=7.381336, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-75';
-- Tetracore - Benin City Bypass  ->  matched "(no match)", moved 0m
update stations set lat=6.607658, lng=5.972271, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-8';
-- Portland Gas Ltd - Kubwa-Gwarimpa Expressway  ->  matched "(no match)", moved 0m
update stations set lat=9.064331, lng=7.489297, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-83';
-- Rolling Energy - Jahi  ->  matched "(no match)", moved 0m
update stations set lat=9.109621, lng=7.438754, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-84';
-- Greenville LNG - Ogbomosho-Jebba Expressway  ->  matched "Greenville LNG Gas Station", moved 0m
update stations set lat=8.496366, lng=4.548048, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-88';
-- NIPCO Gas Limited - Warri-Sapele Rd  ->  matched "NIPCO", moved 18428m
update stations set lat=5.71476, lng=5.757265, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='pci-station-9';
-- Portland Gas CNG - Utako  ->  matched "Portland Gas workshop Utako", moved 1329m
update stations set lat=9.056, lng=7.442, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='portland-cng-utako';
-- Portland Gas / IBILE Mother Station - Ojota  ->  matched "Portland CNG station", moved 213m
update stations set lat=6.5821, lng=3.3791, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='portland-ibile-ojota';
-- Total CNG - Wuse 2  ->  matched "(no match)", moved 0m
update stations set lat=9.0765, lng=7.4853, location_precision='city', accuracy_radius_m=4000, needs_pin_review=true, data_source='PCI centroid (Places match not trusted)' where id='total-cng-wuse2';

commit;

-- 50 reverted, 56 confident rooftop pins kept, 7 verified pins untouched.
