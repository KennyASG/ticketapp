// const { consumeFromQueue } = require("../../../ticket-service/src/workers/rabbitClient.cjs");

// const processReservations = async () => {
//   console.log('Worker de reservas iniciado...');
  
//   while (true) {
//     try {
//       const reservationId = await consumeFromQueue('reserva');
      
//       if (reservationId) {
//         console.log(`✓ Reserva procesada: ${reservationId}`);
//       }
      
//       await new Promise(resolve => setTimeout(resolve, 5000));
//     } catch (error) {
//       console.error('Error:', error.message);
//     }
//   }
// };

// processReservations();