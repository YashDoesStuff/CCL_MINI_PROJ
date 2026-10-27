/**
 * utils/notify.js — Person 2
 * Builds human-readable notification messages for timetable events.
 * No external APIs, no auto-send. Pure string builder.
 * Clipboard copy and WhatsApp redirect are handled on the frontend.
 */

/**
 * buildNotificationMessage
 * @param {string} event  - event key: 'slot-cancelled' | 'slot-opened' | 'slot-claimed'
 * @param {Object} data   - { subject, day, time, faculty }
 * @returns {string}      - formatted message string
 */
function buildNotificationMessage(event, data) {
  switch (event) {
    case "slot-cancelled":
      return `Lecture ${data.subject} on ${data.day} at ${data.time} has been cancelled.`;

    case "slot-opened":
      return `Open slot available: ${data.subject} on ${data.day} at ${data.time}. You can claim it.`;

    case "slot-claimed":
      return `Slot ${data.subject} on ${data.day} at ${data.time} has been claimed by ${data.faculty}.`;

    default:
      return "Timetable has been updated.";
  }
}

/**
 * buildWhatsAppUrl
 * Encodes a message as a wa.me redirect link (no login / API key required).
 * @param {string} phone   - phone number with country code, digits only
 * @param {string} message - plain text message
 * @returns {string}       - https://wa.me/ URL
 */
function buildWhatsAppUrl(phone, message) {
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${phone}?text=${encoded}`;
}

module.exports = { buildNotificationMessage, buildWhatsAppUrl };
