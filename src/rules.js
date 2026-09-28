'use strict';
// Commission parameters for release 2.0.

const BUILD = 'demo/commission-engine-v2';

/** @rule Base commission is 10% of commissionable room revenue. */
const BASE_RATE_PCT = 10;

/** @rule Reservations booked through the GDS channel earn an additional 1.5% channel uplift. */
const GDS_UPLIFT_PCT = 1.5;

/** @rule Stays of 7 nights or more earn a long-stay bonus of 1.5%. */
const LONG_STAY_NIGHTS = 7;
const LONG_STAY_BONUS_PCT = 1.5;

/** @rule Commission per reservation is capped at USD 750. */
const CAP_USD = 750;

/** @rule Commission is rounded half-up to 2 decimal places. */
const DECIMALS = 2;

/** @rule Group reservations of 10 or more rooms are commissioned at a flat 8%. */
const GROUP_MIN_ROOMS = 10;
const GROUP_FLAT_RATE_PCT = 8;

/** @rule Negotiated corporate rates (rate plan CORP) are commissioned at a flat 5%. */
const CORPORATE_RATE_PCT = 5;

// Package rates: commission is paid on the room component of the package price.
const PACKAGE_ROOM_COMPONENT_PCT = 70;

const NON_COMMISSIONABLE_STATUSES = ['CANCELLED', 'NO_SHOW'];

module.exports = { BUILD, BASE_RATE_PCT, GDS_UPLIFT_PCT, LONG_STAY_NIGHTS, LONG_STAY_BONUS_PCT, CAP_USD, DECIMALS,
  GROUP_MIN_ROOMS, GROUP_FLAT_RATE_PCT, CORPORATE_RATE_PCT, PACKAGE_ROOM_COMPONENT_PCT, NON_COMMISSIONABLE_STATUSES };
