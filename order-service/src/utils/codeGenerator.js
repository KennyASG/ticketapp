const crypto = require("crypto");

/**
 * Genera código único para ticket (puede ser QR)
 */
function generateTicketCode(orderId, ticketNumber) {
  const timestamp = Date.now();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `TKT-${orderId}-${ticketNumber}-${random}-${timestamp}`;
}

module.exports = { generateTicketCode };