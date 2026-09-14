-- Attaches real photos of the Rolling Energy - Jahi (FCT Abuja) CNG station,
-- supplied by the project owner from the official Pi-CNG photo gallery.
-- Images are served as static files from the app's own public/ folder
-- (public/stations/rolling-energy-jahi/*.jpg), same pattern as the
-- onboarding screen's images — no Supabase Storage bucket needed.

update stations
set images = array[
  '/stations/rolling-energy-jahi/canopy.jpg',
  '/stations/rolling-energy-jahi/commissioning.jpg',
  '/stations/rolling-energy-jahi/tanker.jpg'
]
where id = 'pci-station-84';
