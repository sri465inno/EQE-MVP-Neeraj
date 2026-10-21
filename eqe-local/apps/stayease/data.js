'use strict';
// Synthetic hotel catalogue for the StayEase demo app.
const room = (id, name, rate, maxGuests) => ({ id, name, rate, maxGuests });
const stdRooms = (base) => [
  room('std-king', 'Standard King', base, 2),
  room('dlx-twin', 'Deluxe Twin', Math.round(base * 1.35), 3),
  room('suite', 'Family Suite', Math.round(base * 2.1), 5),
];
const hotel = (id, name, city, country, stars, rating, base, amenities, area) => ({
  id, name, city, country, stars, rating, area, amenities, rooms: stdRooms(base),
});
module.exports = [
  hotel('par-marais', 'Le Marais Boutique', 'Paris', 'France', 4, 8.7, 210, ['Free Wi-Fi', 'Breakfast', 'Air conditioning'], 'Le Marais'),
  hotel('par-seine', 'Seine Riverside Grand', 'Paris', 'France', 5, 9.2, 390, ['Free Wi-Fi', 'Spa', 'Restaurant', 'Concierge'], 'Saint-Germain'),
  hotel('par-gare', 'Gare du Nord Inn', 'Paris', 'France', 3, 7.6, 120, ['Free Wi-Fi', '24h reception'], 'Gare du Nord'),
  hotel('lon-covent', 'Covent Garden House', 'London', 'United Kingdom', 4, 8.9, 240, ['Free Wi-Fi', 'Gym', 'Bar'], 'Covent Garden'),
  hotel('lon-thames', 'Thames View Palace', 'London', 'United Kingdom', 5, 9.4, 420, ['Free Wi-Fi', 'Spa', 'Pool', 'Restaurant'], 'South Bank'),
  hotel('lon-kings', 'Kings Cross Lodge', 'London', 'United Kingdom', 3, 7.9, 135, ['Free Wi-Fi', 'Breakfast'], 'Kings Cross'),
  hotel('nyc-central', 'Central Park Residences', 'New York', 'United States', 5, 9.1, 460, ['Free Wi-Fi', 'Gym', 'Restaurant', 'Valet parking'], 'Midtown'),
  hotel('nyc-soho', 'SoHo Loft Hotel', 'New York', 'United States', 4, 8.5, 280, ['Free Wi-Fi', 'Rooftop bar'], 'SoHo'),
  hotel('nyc-brooklyn', 'Brooklyn Bridge Stay', 'New York', 'United States', 3, 7.8, 160, ['Free Wi-Fi', 'Pet friendly'], 'Brooklyn'),
  hotel('tyo-ginza', 'Ginza Lantern Hotel', 'Tokyo', 'Japan', 5, 9.3, 380, ['Free Wi-Fi', 'Onsen', 'Restaurant'], 'Ginza'),
  hotel('tyo-shinjuku', 'Shinjuku Skyline', 'Tokyo', 'Japan', 4, 8.6, 220, ['Free Wi-Fi', 'Gym', 'Bar'], 'Shinjuku'),
  hotel('goa-beach', 'Goa Palm Beach Resort', 'Goa', 'India', 4, 8.4, 140, ['Free Wi-Fi', 'Pool', 'Beach access', 'Breakfast'], 'Calangute'),
];
