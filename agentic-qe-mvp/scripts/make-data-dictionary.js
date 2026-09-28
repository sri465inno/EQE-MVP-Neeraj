'use strict';
// Generates the 1000-attribute reservation data dictionary shipped with the sample commission engine.
// Deterministic: 20 attribute groups x 50 attributes. The commission-driving attributes are named explicitly.
const fs = require('fs');
const path = require('path');

const DRIVERS = [
  { name: 'reservation.status', type: 'enum', values: ['CONFIRMED', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'], example: 'CONFIRMED', description: 'Lifecycle status of the reservation' },
  { name: 'stay.nights', type: 'integer', example: 3, description: 'Number of room nights' },
  { name: 'revenue.totalAmount', type: 'decimal', example: 1000, description: 'Gross amount charged, including taxes, fees and ancillaries' },
  { name: 'revenue.taxAmount', type: 'decimal', example: 120, description: 'Taxes included in revenue.totalAmount' },
  { name: 'revenue.resortFeeAmount', type: 'decimal', example: 30, description: 'Resort fees included in revenue.totalAmount' },
  { name: 'revenue.ancillaryAmount', type: 'decimal', example: 50, description: 'Ancillary charges (spa, dining, parking) included in revenue.totalAmount' },
  { name: 'channel.bookingChannel', type: 'enum', values: ['DIRECT', 'GDS', 'OTA', 'CALL_CENTER'], example: 'DIRECT', description: 'Channel the reservation was booked through' },
  { name: 'advisor.iataNumber', type: 'string', example: '45678901', description: 'IATA number of the booking travel advisor' },
  { name: 'payment.loyaltyPointsRedemption', type: 'boolean', example: false, description: 'True when the stay is paid with loyalty points' },
  { name: 'rate.planCategory', type: 'enum', values: ['BAR', 'CORP', 'PKG', 'GROUP', 'PROMO'], example: 'BAR', description: 'Category of the booked rate plan' },
  { name: 'room.roomCount', type: 'integer', example: 1, description: 'Number of rooms held under the reservation' },
];

const GROUPS = {
  reservation: ['confirmation', 'source', 'booker', 'segment', 'origin', 'modification', 'hold', 'waitlist', 'reference', 'sharer'],
  stay: ['arrival', 'departure', 'checkIn', 'checkOut', 'earlyArrival', 'lateDeparture', 'extension', 'dayUse', 'season', 'weekend'],
  room: ['roomType', 'roomClass', 'bedType', 'view', 'floor', 'accessibility', 'smoking', 'upgrade', 'connecting', 'inventory'],
  rate: ['ratePlan', 'rateCode', 'rateAmount', 'rateCurrency', 'discount', 'promotion', 'negotiated', 'restriction', 'rateRule', 'yield'],
  revenue: ['roomRevenue', 'fnbRevenue', 'spaRevenue', 'parking', 'minibar', 'deposit', 'balance', 'adjustment', 'refund', 'invoice'],
  channel: ['channelCode', 'subChannel', 'gdsCode', 'pcc', 'otaPartner', 'metaSearch', 'callCenter', 'agency', 'consortium', 'wholesaler'],
  advisor: ['agency', 'agencyName', 'agencyCountry', 'consortium', 'hostAgency', 'contract', 'tier', 'payee', 'taxId', 'bankAccount'],
  guest: ['profile', 'firstName', 'lastName', 'email', 'phone', 'country', 'language', 'nationality', 'vip', 'preference'],
  loyalty: ['member', 'memberTier', 'points', 'pointsEarned', 'pointsBurned', 'status', 'enrollment', 'partner', 'benefit', 'milestone'],
  property: ['propertyCode', 'brand', 'region', 'country', 'city', 'timezone', 'starRating', 'ownership', 'management', 'franchise'],
  payment: ['method', 'cardType', 'cardToken', 'authorisation', 'guarantee', 'currency', 'exchangeRate', 'billing', 'prepayment', 'voucher'],
  package: ['packageCode', 'component', 'inclusion', 'breakfast', 'transfer', 'credit', 'experience', 'packagePrice', 'packageRule', 'bundle'],
  group: ['groupCode', 'block', 'pickup', 'cutoff', 'attrition', 'rooming', 'masterAccount', 'meeting', 'event', 'contract'],
  corporate: ['account', 'accountName', 'travelPolicy', 'costCentre', 'traveller', 'approval', 'negotiatedRate', 'volume', 'rfp', 'lra'],
  cancellation: ['policy', 'deadline', 'penalty', 'reason', 'requestedAt', 'waiver', 'noShowFee', 'refundable', 'forfeit', 'rebook'],
  ancillary: ['spa', 'dining', 'golf', 'parking', 'petFee', 'crib', 'extraBed', 'laundry', 'wifi', 'minibar'],
  marketing: ['campaign', 'promoCode', 'utmSource', 'utmMedium', 'consent', 'segment', 'persona', 'survey', 'referral', 'attribution'],
  compliance: ['gdpr', 'retention', 'kyc', 'sanctions', 'taxRegion', 'invoiceRule', 'dataResidency', 'audit', 'consent', 'pci'],
  distribution: ['pmsId', 'crsId', 'channelManager', 'mapping', 'syncStatus', 'lastSync', 'errorCode', 'retry', 'feed', 'parity'],
  audit: ['createdBy', 'createdAt', 'updatedBy', 'updatedAt', 'version', 'sourceSystem', 'correlationId', 'checksum', 'archived', 'lock'],
};
const FACETS = [
  ['Code', 'string'], ['Status', 'enum'], ['Date', 'date'], ['Amount', 'decimal'], ['Count', 'integer'], ['Flag', 'boolean'],
];

function example(type, i) {
  switch (type) {
    case 'string': return `X${String(i).padStart(4, '0')}`;
    case 'enum': return 'STANDARD';
    case 'date': return '2026-10-01';
    case 'decimal': return 0;
    case 'integer': return 0;
    case 'boolean': return false;
    default: return null;
  }
}

function build() {
  const attributes = [];
  const seen = new Set();
  const add = (a) => { if (!seen.has(a.name)) { seen.add(a.name); attributes.push(a); } };
  for (const [group, nouns] of Object.entries(GROUPS)) {
    const inGroup = () => attributes.filter((a) => a.group === group).length;
    for (const d of DRIVERS.filter((x) => x.name.startsWith(`${group}.`))) add({ ...d, group, required: true, commissionDriver: true });
    outer: for (const [suffix, type] of FACETS) {
      for (const noun of nouns) {
        if (inGroup() >= 50) break outer;
        add({ name: `${group}.${noun}${suffix}`, group, type, required: false, commissionDriver: false, example: example(type, attributes.length), description: `${noun} ${suffix.toLowerCase()} (${group})` });
      }
    }
    if (inGroup() !== 50) throw new Error(`${group} has ${inGroup()} attributes`);
  }
  return { name: 'Reservation', version: '2026.3', description: 'Aurora Hotels reservation model used by the commission engine', count: attributes.length, groups: Object.keys(GROUPS), attributes };
}

function serialise(dict) {
  const { attributes, ...head } = dict;
  const top = JSON.stringify(head, null, 2).replace(/\n}$/, '');
  return `${top},\n  "attributes": [\n${attributes.map((a) => `    ${JSON.stringify(a)}`).join(',\n')}\n  ]\n}\n`;
}

if (require.main === module) {
  const dict = build();
  for (const b of ['baseline', 'v2']) {
    const file = path.join(__dirname, '..', 'samples', 'commission-engine', b, 'data-dictionary', 'reservation-attributes.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, serialise(dict));
    console.log(`${file}: ${dict.count} attributes, ${dict.attributes.filter((a) => a.commissionDriver).length} commission drivers`);
  }
}

module.exports = { build, serialise, DRIVERS };
