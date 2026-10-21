'use strict';
// Seed requirements: initiatives MGPP-1 (booking) and MGPP-2 (create and cancel) (portfolio project MGPP) with epics and stories in project EQE (StayEase online booking). Acceptance criteria live in the description,
// as in many real Jira projects, under an "Acceptance criteria" heading.
// testData: lines "Name: value" kept under a "Test data" heading in the description; the EQE dashboard designs with these values.
const I = (key, type, summary, parent, priority, text, ac = [], labels = [], testData = []) => ({ key, type, summary, parent, priority, text, ac, labels, testData });
module.exports = [
  I('MGPP-1', 'Initiative', 'Guests can book hotel stays online on StayEase', null, 'High',
    'Business goal: let guests search for hotels, find a hotel and an existing reservation, and create a reservation without calling the reservations desk. Members sign in to book and earn points by level (Gold, Platinum, Ambassador). Scope for this release: web channel only.', [], ['booking', 'web']),
  I('EQE-2', 'Epic', 'Search hotels', 'MGPP-1', 'High', 'Guests search the hotel catalogue by destination, dates and party size, and refine the results.', [], ['search']),
  I('EQE-3', 'Epic', 'Find hotel and reservation', 'MGPP-1', 'High', 'Guests find a hotel\'s details and look up a reservation they already made.', [], ['find']),
  I('EQE-4', 'Epic', 'Create reservation', 'MGPP-1', 'Highest', 'Guests reserve a room and receive a confirmation number.', [], ['reservation']),
  I('EQE-5', 'Story', 'Search hotels by destination, dates and guests', 'EQE-2', 'High',
    'As a guest, I want to search hotels by destination, dates and number of guests so that I can see which hotels are available for my stay.', [
      'Given the guest is on the home page, when they enter a destination, check-in date, check-out date and number of guests and select Search, then the search results list the available hotels in that destination.',
      'When the destination is left empty and the guest selects Search, the message "Please enter a destination" is shown.',
      'When the check-out date is not after the check-in date, the message "Check-out date must be after check-in date" is shown.',
      'When no hotel matches the destination, the message "No hotels found" is shown.',
    ], ['search'], ['Destination: Paris', 'Check-in: today + 21 days', 'Nights: 3', 'Guests: 2', 'Destination with no hotels: Atlantis']),
  I('EQE-6', 'Story', 'Sort and filter search results', 'EQE-2', 'Medium',
    'As a guest, I want to sort and filter the search results so that I can quickly compare hotels.', [
      'The guest can sort the results by "Price: low to high"; the hotels are then listed in ascending order of nightly price.',
      'The guest can filter the results by minimum star rating "5 stars only"; only 5-star hotels are shown.',
      'Results load quickly after the guest changes the sort order.',
    ], ['search']),
  I('EQE-7', 'Story', 'View hotel details', 'EQE-3', 'High',
    'As a guest, I want to open a hotel from the search results so that I can see its amenities and rooms before I book.', [
      'When the guest selects View details on a hotel in the results, the hotel details page shows the hotel name, star rating and the "Amenities" section.',
      'The hotel details page lists the "Rooms" available for the stay with the nightly price and a Reserve option for each room.',
    ], ['find']),
  I('EQE-8', 'Story', 'Find an existing reservation', 'EQE-3', 'High',
    'As a guest, I want to find my reservation with my confirmation number and last name so that I can check my booking.', [
      'Given a confirmed reservation, when the guest enters the confirmation number and last name on Find reservation, then the "Reservation details" are shown with status "Confirmed".',
      'When no reservation matches the confirmation number and last name, the message "We could not find a reservation with those details" is shown.',
      'The last name match ignores letter case.',
    ], ['find'], ['Unknown confirmation number: SE000000', 'Unknown last name: Nobody']),
  I('EQE-9', 'Story', 'Book a room', 'EQE-4', 'Highest',
    'As a guest, I want to reserve a room by entering my details so that my stay is confirmed.', [
      'Given the guest selected a room, when they enter first name, last name, email and phone and select Confirm reservation, then the "Reservation confirmed" page shows a confirmation number.',
      'The "Booking summary" shows the hotel, the room and the number of nights of the stay.',
      'When the email address is not valid, the message "Please enter a valid email address" is shown.',
      'A confirmation email is sent to the guest\'s email address.',
    ], ['reservation'], ['Guest first name: Ava', 'Guest last name: Thompson', 'Guest email: ava.thompson@example.com', 'Guest phone: +1 415 555 0134', 'Invalid email: ava.thompson@example']),
  I('EQE-10', 'Story', 'Guest details are mandatory', 'EQE-4', 'Medium',
    'As the hotel, we need complete guest details on every reservation.', [
      'First name, last name, email and phone are required: when any of them is left empty and the guest selects Confirm reservation, the message "This field is required" is shown.',
    ], ['reservation']),
  // Member login and loyalty (MGPP-1): members sign in to book and earn points by level.
  I('EQE-17', 'Epic', 'Member login and loyalty', 'MGPP-1', 'High', 'Members sign in and out, must be signed in to reserve, earn points per night by level (Gold, Platinum, Ambassador) and see their reservations in their account.', [], ['member', 'loyalty']),
  I('EQE-18', 'Story', 'Member signs in and signs out', 'EQE-17', 'High',
    'As a member, I want to sign in and sign out of StayEase so that my reservations and points are linked to my account.', [
      'Given a member is on the Sign in page, when they enter their email and password and select Sign in, then the header shows "Signed in as" with the member\'s name and level.',
      'When the email or password is wrong, the message "Incorrect email or password" is shown.',
      'When the signed-in member selects Sign out, the message "You have been signed out" is shown.',
    ], ['member'], ['Gold member email: ava.thompson@example.com', 'Gold member password: gold2026', 'Wrong password: wrong-password']),
  I('EQE-19', 'Story', 'Sign in is required to make a reservation', 'EQE-17', 'Highest',
    'As the hotel, we want every reservation to belong to a signed-in member so that points are credited to the right account.', [
      'When a guest who is not signed in selects Reserve on a room, the Sign in page opens with the message "Please sign in to make a reservation".',
      'After signing in, the member returns to "Complete your reservation" for the room they selected.',
    ], ['member', 'reservation']),
  I('EQE-20', 'Story', 'Members earn points by level', 'EQE-17', 'High',
    'As a member, I want to earn points on every reservation according to my level (Gold, Platinum or Ambassador) so that I am rewarded for staying with StayEase.', [
      'Gold members earn 500 points per night: when a Gold member books a 3-night stay, the "Reservation confirmed" page shows "You earned 1,500 points".',
      'Platinum members earn 750 points per night: when a Platinum member books a 3-night stay, the "Reservation confirmed" page shows "You earned 2,250 points".',
      'Ambassador members earn 1,000 points per night: when an Ambassador member books a 3-night stay, the "Reservation confirmed" page shows "You earned 3,000 points".',
    ], ['loyalty'], ['Platinum member email: liam.carter@example.com', 'Platinum member password: platinum2026', 'Ambassador member email: priya.nair@example.com', 'Ambassador member password: ambassador2026']),
  I('EQE-21', 'Story', 'Reservations are kept in the member\'s account', 'EQE-17', 'High',
    'As a member, I want my reservations to stay in my account so that I can see them every time I sign in.', [
      'When the member opens "My account", the "My reservations" list shows the new reservation with its confirmation number and the "Points balance".',
      'When the member signs out and signs in again, the reservation is still listed in "My reservations".',
      'When the demo data is reset, the member\'s reservations and points are removed.',
    ], ['member', 'loyalty']),
  // Initiative MGPP-2: create and cancel a reservation.
  I('MGPP-2', 'Initiative', 'Guests can create and cancel their StayEase reservations online', null, 'High',
    'Business goal: guests create a reservation and cancel it themselves online, without calling the reservations desk. Scope for this release: web channel only.', [], ['reservation', 'cancel', 'web']),
  I('EQE-11', 'Epic', 'Create reservation (self-service)', 'MGPP-2', 'Highest', 'Guests create a reservation, review the booking summary and open it again from the confirmation page.', [], ['reservation']),
  I('EQE-12', 'Epic', 'Cancel reservation', 'MGPP-2', 'High', 'Guests cancel a confirmed reservation from Find reservation.', [], ['cancel']),
  I('EQE-13', 'Story', 'Create a reservation and review the booking summary', 'EQE-11', 'Highest',
    'As a guest, I want to create a reservation and see a complete booking summary so that I know exactly what I booked.', [
      'Given the guest selected a room, when they enter their details and select Confirm reservation, then the "Reservation confirmed" page shows a confirmation number and the message "Your stay is booked".',
      'The "Booking summary" shows the status "Confirmed", the check-in date, the check-out date and the number of guests chosen in the search.',
      'The "Booking summary" shows the "Total paid" for the stay.',
    ], ['reservation'], ['Destination: Paris', 'Check-in: today + 21 days', 'Nights: 3', 'Guests: 2', 'Guest first name: Ava', 'Guest last name: Thompson', 'Guest email: ava.thompson@example.com', 'Guest phone: +1 415 555 0134']),
  I('EQE-14', 'Story', 'Open a new reservation from the confirmation page', 'EQE-11', 'High',
    'As a guest, I want to open my new reservation from the confirmation page so that I can manage it later.', [
      'When the guest selects "Manage this reservation" on the confirmation page, the "Find your reservation" page opens.',
      'When the guest enters the new confirmation number and last name and selects Find reservation, the "Reservation details" are shown with status "Confirmed".',
      'The confirmation number match ignores letter case.',
    ], ['reservation']),
  I('EQE-15', 'Story', 'Cancel a confirmed reservation', 'EQE-12', 'Highest',
    'As a guest, I want to cancel my reservation online so that I do not have to call the hotel.', [
      'Given a confirmed reservation is shown on Find reservation, the "Cancel reservation" option is available.',
      'When the guest selects Cancel reservation and confirms "Cancel this reservation?", the reservation status changes to "Cancelled".',
      'When the guest dismisses the "Cancel this reservation?" prompt, the reservation stays "Confirmed".',
    ], ['cancel']),
  I('EQE-16', 'Story', 'Cancelled reservations cannot be cancelled again', 'EQE-12', 'Medium',
    'As the hotel, we want a cancelled reservation to stay cancelled so that it is not processed twice.', [
      'When the guest finds a reservation with status "Cancelled", the "Cancel reservation" option is not shown.',
      'A cancellation confirmation email is sent to the guest.',
    ], ['cancel']),
];
