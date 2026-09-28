'use strict';
const R = require('./rules');

function roundHalfUp(x, dp = R.DECIMALS) {
  const f = 10 ** dp;
  return Math.round((x + Number.EPSILON) * f) / f;
}

const num = (res, key) => Number(res[key] || 0);

function commissionableRevenue(res) {
  return roundHalfUp(num(res, 'revenue.totalAmount') - num(res, 'revenue.taxAmount') - num(res, 'revenue.resortFeeAmount') - num(res, 'revenue.ancillaryAmount'));
}

function rateLines(res) {
  if (res['rate.planCategory'] === 'CORP') return [{ code: 'CORPORATE', label: 'Negotiated corporate rate', ratePct: R.CORPORATE_RATE_PCT }];
  if (num(res, 'room.roomCount') >= R.GROUP_MIN_ROOMS) return [{ code: 'GROUP', label: 'Group flat rate', ratePct: R.GROUP_FLAT_RATE_PCT }];
  const lines = [{ code: 'BASE', label: 'Base commission', ratePct: R.BASE_RATE_PCT }];
  if (res['channel.bookingChannel'] === 'GDS') lines.push({ code: 'GDS_UPLIFT', label: 'GDS channel uplift', ratePct: R.GDS_UPLIFT_PCT });
  // Intentional demo defect: the rule says "7 nights or more" but this checks strictly more than 7.
  if (num(res, 'stay.nights') > R.LONG_STAY_NIGHTS) lines.push({ code: 'LONG_STAY', label: 'Long-stay bonus', ratePct: R.LONG_STAY_BONUS_PCT });
  return lines;
}

function calculateCommission(res) {
  const revenue = commissionableRevenue(res);
  const basis = res['rate.planCategory'] === 'PKG' ? roundHalfUp((revenue * R.PACKAGE_ROOM_COMPONENT_PCT) / 100) : revenue;
  const head = { currency: 'USD', build: R.BUILD, commissionableRevenue: revenue, basis };
  const status = res['reservation.status'];
  if (R.NON_COMMISSIONABLE_STATUSES.includes(status)) {
    return { ...head, eligible: false, reason: `Reservation status ${status} is not commissionable`, lines: [], effectiveRatePct: 0, grossCommission: 0, capped: false, capUsd: R.CAP_USD, commission: 0 };
  }
  if (res['payment.loyaltyPointsRedemption'] === true) {
    return { ...head, eligible: false, reason: 'Paid with loyalty points - not commissionable', lines: [], effectiveRatePct: 0, grossCommission: 0, capped: false, capUsd: R.CAP_USD, commission: 0 };
  }
  const lines = rateLines(res).map((l) => ({ ...l, amount: roundHalfUp((basis * l.ratePct) / 100) }));
  const effectiveRatePct = lines.reduce((s, l) => s + l.ratePct, 0);
  const gross = (basis * effectiveRatePct) / 100;
  const capped = gross > R.CAP_USD;
  return { ...head, eligible: true, reason: null, lines, effectiveRatePct, grossCommission: roundHalfUp(gross), capped, capUsd: R.CAP_USD, commission: roundHalfUp(Math.min(gross, R.CAP_USD)) };
}

module.exports = { calculateCommission, commissionableRevenue, roundHalfUp };
