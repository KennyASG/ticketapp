// ================================================
// 🐰 RABBITMQ QUEUE HELPERS
// ================================================
// Funciones para validar y gestionar asientos en colas
// Copiar en: shared/queueHelpers.js o en cada servicio

const { consumeBatchFromQueue, publishToQueue } = require('../workers/rabbitClient');

// ================================================
// 1. VERIFICAR SI ASIENTOS ESTÁN EN UNA COLA
// ================================================
/**
 * Verifica si alguno de los asientos está en la cola especificada
 * @param {string} queueName - Nombre de la cola
 * @param {Array<number>} seatIds - IDs de asientos a verificar
 * @returns {Promise<{inQueue: Array<number>, canProceed: boolean}>}
 */
const checkSeatsInQueue = async (queueName, seatIds) => {
  try {
    // Consumir todos los mensajes actuales de la cola
    const messages = await consumeBatchFromQueue(queueName, 100);
    
    // Republicar todos los mensajes (no los queremos consumir, solo leer)
    for (const message of messages) {
      await publishToQueue(queueName, message);
    }
    
    // Extraer todos los seatIds de los mensajes
    const occupiedSeats = new Set();
    messages.forEach(msg => {
      if (msg.seatIds && Array.isArray(msg.seatIds)) {
        msg.seatIds.forEach(id => occupiedSeats.add(id));
      }
    });
    
    // Verificar conflictos
    const conflictingSeats = seatIds.filter(id => occupiedSeats.has(id));
    
    return {
      inQueue: conflictingSeats,
      canProceed: conflictingSeats.length === 0,
      totalInQueue: occupiedSeats.size
    };
  } catch (error) {
    console.error(`❌ [Queue] Error checking seats in ${queueName}:`, error);
    // Si falla RabbitMQ, permitir continuar (fail-safe)
    return {
      inQueue: [],
      canProceed: true,
      totalInQueue: 0
    };
  }
};

// ================================================
// 2. LIBERAR ASIENTOS DE UNA COLA
// ================================================
/**
 * Remueve mensajes que contienen los asientos especificados
 * @param {string} queueName - Nombre de la cola
 * @param {Array<number>} seatIds - IDs de asientos a liberar
 * @param {number} reservationId - ID de reserva/orden para matching
 * @returns {Promise<{removed: number}>}
 */
const removeSeatsFromQueue = async (queueName, seatIds, reservationId = null) => {
  try {
    // Consumir todos los mensajes
    const messages = await consumeBatchFromQueue(queueName, 100);
    
    let removedCount = 0;
    
    // Republicar solo los que NO coinciden
    for (const message of messages) {
      let shouldKeep = true;
      
      // Verificar si este mensaje debe ser removido
      if (reservationId && message.reservationId === reservationId) {
        shouldKeep = false;
        removedCount++;
      } else if (message.orderId && reservationId && message.orderId === reservationId) {
        shouldKeep = false;
        removedCount++;
      } else if (message.seatIds && Array.isArray(message.seatIds)) {
        // Verificar si algún seat coincide
        const hasConflict = message.seatIds.some(id => seatIds.includes(id));
        if (hasConflict) {
          shouldKeep = false;
          removedCount++;
        }
      }
      
      // Republicar si debe mantenerse
      if (shouldKeep) {
        await publishToQueue(queueName, message);
      }
    }
    
    console.log(`🗑️ [Queue] Removed ${removedCount} messages from ${queueName}`);
    
    return {
      removed: removedCount,
      remaining: messages.length - removedCount
    };
  } catch (error) {
    console.error(`❌ [Queue] Error removing seats from ${queueName}:`, error);
    return {
      removed: 0,
      remaining: 0
    };
  }
};

// ================================================
// 3. OBTENER ESTADO DE ASIENTOS EN COLAS
// ================================================
/**
 * Obtiene el estado completo de asientos en ambas colas
 * @param {Array<number>} seatIds - IDs de asientos a verificar
 * @returns {Promise<object>}
 */
const getSeatsQueueStatus = async (seatIds) => {
  const reservaStatus = await checkSeatsInQueue('reserva', seatIds);
  const carritoStatus = await checkSeatsInQueue('carrito', seatIds);
  
  return {
    inReserva: reservaStatus.inQueue,
    inCarrito: carritoStatus.inQueue,
    canReserve: reservaStatus.canProceed, // Solo si NO está en RESERVA
    canAddToCart: carritoStatus.canProceed, // Solo si NO está en CARRITO
    details: {
      reserva: reservaStatus,
      carrito: carritoStatus
    }
  };
};

module.exports = {
  checkSeatsInQueue,
  removeSeatsFromQueue,
  getSeatsQueueStatus
};