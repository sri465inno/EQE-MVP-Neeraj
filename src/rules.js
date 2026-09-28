'use strict';
// Commission parameters for release 1.0.

const BUILD = 'demo/commission-engine';

/** @rule Base commission is 10% of commissionable room revenue. */
const BASE_RATE_PCT = 10;

/** @rule Reservations booked through the GDS channel earn an additional 1.5% channel uplift. */
const GDS_UPLIFT_PCT = 1.5;

/** @rule Stays of 7 nights or more earn a long-stay bonus of 1.5%. */
const LONG_STAY_NIGHTS = 7;
const LONG_STAY_BONUS_PCT = 1.5;

/** @rule Commission per reservation is capped at USD 500. */
const CAP_USD = 500;

/** @rule Commission is rounded half-up to 2 decimal places. */
const DECIMALS = 2;

const NON_COMMISSIONABLE_STATUSES = ['CANCELLED', 'NO_SHOW'];

module.exports = { BUILD, BASE_RATE_PCT, GDS_UPLIFT_PCT, LONG_STAY_NIGHTS, LONG_STAY_BONUS_PCT, CAP_USD, DECIMALS, NON_COMMISSIONABLE_STATUSES };
