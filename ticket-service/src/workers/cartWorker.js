// const { consumeFromQueue } = require("../../../order-service/src/workers/rabbitClient.cjs");

// const processReservations = async () => {
//     console.log('Worker de carrito iniciado...');

//     while (true) {
//         try {
//             const reservationId = await consumeFromQueue('carrito');

//             if (reservationId) {
//                 console.log(`✓ Reserva procesada: ${reservationId}`);
//             }

//             await new Promise(resolve => setTimeout(resolve, 5000));
//         } catch (error) {
//             console.error('Error:', error.message);
//         }
//     }
// };

// processReservations();