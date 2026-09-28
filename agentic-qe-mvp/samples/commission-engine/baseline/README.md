# Aurora commission engine

Calculates the commission Aurora Hotels pays travel advisors on each reservation. A reservation is described by
the reservation data dictionary (`data-dictionary/reservation-attributes.json`): 1000 attributes in 20 groups, of
which the ones flagged `commissionDriver` feed the calculation. Every request carries the full reservation.

This is a sample codebase for the Agentic QE Platform - MVP demo (branch `demo/commission-engine`, release 1.0).

## Commission rules

- Base commission is 10% of commissionable room revenue.
- Commissionable room revenue excludes taxes, resort fees and ancillary charges.
- Reservations booked through the GDS channel earn an additional 1.5% channel uplift.
- Stays of 7 nights or more earn a long-stay bonus of 1.5%.
- Commission per reservation is capped at USD 500.
- Commission is rounded half-up to 2 decimal places.
- Reservations paid with loyalty points are not commissionable.
- Every reservation is described by a data dictionary of 1000 attributes.
- Every commission calculation is written to the commission audit ledger.

## Service behaviour

- A reservation without an advisor IATA number returns HTTP 422.
- Unknown reservation IDs return HTTP 404.

## API

- `GET /api/data-dictionary` - the reservation model (1000 attributes)
- `POST /api/commission/quote` - body `{ "reservation": { "<attribute>": value, ... } }`, returns the commission breakdown
- `POST /api/reservations` - stores a reservation, returns its ID
- `GET /api/reservations/:id/commission` - commission breakdown for a stored reservation
- `GET /api/ledger` - commission audit ledger
- `GET /` - advisor commission statement page

## Run

```bash
npm install
npm start   # http://localhost:4200 (PORT to change)
```
