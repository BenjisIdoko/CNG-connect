/* ═══════════════════════════════════════════════════════════════════
   Pi-CNG & EV  |  geo-data.js
   Lightweight Nigeria place-name → coordinates lookup, used to plot
   refuelling stations (stations-data.js) on network-map.html.

   Conversion centres come from the live API with real lat/lng already
   attached, so they don't need this file. Refuelling stations only
   ship street addresses, so we approximate each one to the nearest
   named town/district we can recognise in its address string, falling
   back to the state capital when nothing more specific matches.
   Locations plotted this way are approximate, not survey-grade.
   ═══════════════════════════════════════════════════════════════════ */

/* Fallback centre-point per state (used when no area keyword matches) */
var STATE_COORDS = {
  'Abia': [5.4527, 7.5248], 'Adamawa': [9.3265, 12.3984], 'Akwa Ibom': [5.0377, 7.9128],
  'Anambra': [6.2209, 6.9370], 'Bauchi': [10.3158, 9.8442], 'Bayelsa': [4.9267, 6.2676],
  'Benue': [7.7322, 8.5391], 'Borno': [11.8333, 13.1500], 'Cross River': [4.9757, 8.3417],
  'Delta': [5.5320, 5.8987], 'Ebonyi': [6.2649, 8.0137], 'Edo': [6.3350, 5.6037],
  'Ekiti': [7.6211, 5.2213], 'Enugu': [6.4413, 7.4988], 'FCT Abuja': [9.0765, 7.3986],
  'Gombe': [10.2897, 11.1673], 'Imo': [5.4840, 7.0351], 'Jigawa': [12.2280, 9.5616],
  'Kaduna': [10.5222, 7.4383], 'Kano': [12.0022, 8.5920], 'Katsina': [12.9908, 7.6006],
  'Kebbi': [12.4539, 4.1975], 'Kogi': [7.8023, 6.7337], 'Kwara': [8.4966, 4.5426],
  'Lagos': [6.5244, 3.3792], 'Nasarawa': [8.4939, 8.5163], 'Niger': [9.6139, 6.5569],
  'Ogun': [7.1475, 3.3619], 'Ondo': [7.2571, 5.2058], 'Osun': [7.5629, 4.5200],
  'Oyo': [7.3775, 3.9470], 'Plateau': [9.2182, 9.5179], 'Rivers': [4.8156, 7.0498],
  'Sokoto': [13.0059, 5.2476], 'Taraba': [8.8937, 11.3604], 'Yobe': [11.7469, 11.9660],
  'Zamfara': [12.1704, 6.2454]
};

/* Named towns / districts referenced inside station addresses — first
   match wins, so more specific keywords are listed before broader ones */
var AREA_COORDS = [
  /* Lagos */
  { re: /sangontedo|lekki-epe|eti-osa|km 44/i,        ll: [6.4698, 3.5852] },
  { re: /agidingbi|ikeja/i,                            ll: [6.6018, 3.3515] },
  { re: /apapa/i,                                      ll: [6.4432, 3.3591] },
  { re: /agege bypass|idimuangoro|agege motor|challenge bus/i, ll: [6.6154, 3.3238] },
  { re: /marina/i,                                     ll: [6.4550, 3.3941] },
  { re: /ago palace/i,                                 ll: [6.4802, 3.3187] },
  { re: /ojota|ogudu/i,                                ll: [6.5809, 3.3762] },
  { re: /itokin road|ikorodu/i,                        ll: [6.6018, 3.5106] },
  { re: /fola agoro|shomolu/i,                         ll: [6.5378, 3.3789] },
  { re: /lagos-epe expressway/i,                       ll: [6.5550, 3.7900] },
  { re: /isolo|ilasamaja/i,                             ll: [6.5352, 3.3227] },
  { re: /oshodi/i,                                     ll: [6.5500, 3.3489] },

  /* Ogun */
  { re: /sango-otta|sango otta/i,                      ll: [6.6903, 3.2400] },
  { re: /ibafo/i,                                      ll: [6.7554, 3.4319] },
  { re: /ogbere|sagamu-ore/i,                          ll: [6.9500, 3.7500] },
  { re: /kuto/i,                                       ll: [7.1500, 3.3486] },
  { re: /redemption camp|km 46/i,                      ll: [6.8100, 3.4300] },
  { re: /ilishan/i,                                    ll: [6.8833, 3.7000] },
  { re: /sagamu/i,                                     ll: [6.8480, 3.6404] },

  /* Oyo */
  { re: /tollgate|lagos\/ibadan expressway|agodi|ajibode|alakia|ibadan/i, ll: [7.3775, 3.9470] },

  /* Ondo / Ekiti / Osun */
  { re: /akure/i,                                      ll: [7.2571, 5.2058] },
  { re: /ado ekiti|ado-ekiti/i,                        ll: [7.6211, 5.2213] },
  { re: /ile-ife|obafemi awolowo university/i,         ll: [7.4905, 4.5521] },

  /* Edo / Delta / Rivers */
  { re: /benin city|benin sapele|agbor road|uselu|eyaen|oluku|uwusan/i, ll: [6.3350, 5.6037] },
  { re: /warri/i,                                      ll: [5.5160, 5.7500] },
  { re: /asaba/i,                                      ll: [6.2059, 6.7401] },
  { re: /port harcourt|rumuji|akpajo/i,                ll: [4.8156, 7.0498] },

  /* South-East */
  { re: /enugu/i,                                      ll: [6.4413, 7.4988] },

  /* North-West */
  { re: /kakau village|chikun|kaduna/i,                ll: [10.5222, 7.4383] },
  { re: /zaria road|kano-zaria|buk road|kano/i,        ll: [12.0022, 8.5920] },
  { re: /batagarawa|katsina/i,                         ll: [12.9908, 7.6006] },
  { re: /sokoto/i,                                     ll: [13.0059, 5.2476] },

  /* FCT Abuja districts */
  { re: /gosa/i,                                       ll: [8.9700, 7.3300] },
  { re: /kubwa/i,                                      ll: [9.1500, 7.3333] },
  { re: /gaduwa/i,                                     ll: [8.9833, 7.4333] },
  { re: /zone 1|prince ?& ?princess/i,                 ll: [9.0667, 7.4833] },
  { re: /dei-dei/i,                                    ll: [9.1167, 7.3167] },
  { re: /dutse-bwari|dutse/i,                          ll: [9.1300, 7.4200] },
  { re: /tungamaje|lokoja-kaduna expressway/i,         ll: [9.2000, 7.3500] },
  { re: /madalla/i,                                    ll: [9.1167, 7.1333] },
  { re: /mabushi/i,                                    ll: [9.0833, 7.4500] },
  { re: /\bjahi\b/i,                                   ll: [9.1050, 7.4150] },
  { re: /university of abuja|km 23, airport road/i,    ll: [8.9333, 7.1833] },
  { re: /lugbe|aust retail/i,                          ll: [8.9833, 7.3667] },
  { re: /constitution ave|\bcbd\b/i,                   ll: [9.0400, 7.4900] },

  /* Kogi / Nasarawa / Kwara / Niger */
  { re: /okene/i,                                      ll: [7.5525, 6.2350] },
  { re: /ajaokuta/i,                                   ll: [7.5167, 6.6667] },
  { re: /obajana/i,                                    ll: [7.7000, 6.3500] },
  { re: /felele|abuja-okene expressway|lokoja/i,       ll: [7.8023, 6.7337] },
  { re: /lafia/i,                                      ll: [8.4939, 8.5163] },
  { re: /new karu|mararraba/i,                         ll: [9.0125, 7.5806] },
  { re: /ilorin/i,                                     ll: [8.4966, 4.5426] },
  { re: /minna/i,                                      ll: [9.6139, 6.5569] },

  /* North-East */
  { re: /jimeta|numan road/i,                          ll: [9.2833, 12.4667] }
];

/* Deterministic small offset so multiple stations resolved to the same
   fallback point fan out slightly instead of stacking exactly on top
   of one another. Not randomised — same input always gives same output. */
function geoJitter(seed, lat, lng) {
  var h = 0;
  for (var i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  var dx = ((h % 1000) / 1000 - 0.5) * 0.06;
  var dy = (((h >> 10) % 1000) / 1000 - 0.5) * 0.06;
  return [lat + dx, lng + dy];
}

/* Resolve a station's approximate [lat, lng] from its address + state */
function geocodeStation(station) {
  var addr = station.address || '';
  for (var i = 0; i < AREA_COORDS.length; i++) {
    if (AREA_COORDS[i].re.test(addr)) return AREA_COORDS[i].ll;
  }
  var base = STATE_COORDS[station.state] || STATE_COORDS['FCT Abuja'];
  return geoJitter(station.company + '|' + station.sn + '|' + station.address, base[0], base[1]);
}
