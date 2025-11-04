// ================================================
// 🐰 RABBITMQ CLIENT - API REST
// ================================================
// Este cliente usa la API REST de RabbitMQ Management
// Compatible con tu configuración actual en ingeniebrios.work.gd

const axios = require('axios');

const RABBIT_CONFIG = {
  url: 'http://ingeniebrios.work.gd:31672/api',
  auth: {
    username: 'apiuser',
    password: 'apiuser'
  },
  vhost: '%2f', // "/" encoded
  exchange: 'amq.default' // Direct exchange por defecto
};

// ================================================
// PUBLICAR MENSAJE EN COLA
// ================================================
/**
 * Publica un mensaje en una cola específica
 * @param {string} queueName - Nombre de la cola
 * @param {object} payload - Datos a enviar
 * @param {object} options - Opciones adicionales
 * @returns {Promise<boolean>}
 */
const publishToQueue = async (queueName, payload, options = {}) => {
  try {
    const message = {
      properties: {
        delivery_mode: 2, // Persistente
        content_type: 'application/json',
        timestamp: Date.now(),
        ...options.properties
      },
      routing_key: queueName,
      payload: JSON.stringify(payload),
      payload_encoding: "string"
    };

    const response = await axios.post(
      `${RABBIT_CONFIG.url}/exchanges/${RABBIT_CONFIG.vhost}/${RABBIT_CONFIG.exchange}/publish`,
      message,
      { 
        auth: RABBIT_CONFIG.auth,
        timeout: 5000
      }
    );

    if (response.data.routed) {
      console.log(`✅ [RabbitMQ] Mensaje publicado en ${queueName}:`, {
        action: payload.action,
        id: payload.reservationId || payload.orderId || payload.userId
      });
      return true;
    } else {
      console.warn(`⚠️ [RabbitMQ] Mensaje no enrutado a ${queueName}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ [RabbitMQ] Error publishing to ${queueName}:`, error.message);
    // No lanzar error para no romper el flujo principal
    return false;
  }
};

// ================================================
// CONSUMIR MENSAJE DE COLA
// ================================================
/**
 * Consume UN mensaje de una cola
 * @param {string} queueName - Nombre de la cola
 * @param {boolean} autoAck - Auto-acknowledgement
 * @returns {Promise<object|null>}
 */
const consumeFromQueue = async (queueName, autoAck = true) => {
  try {
    const response = await axios.post(
      `${RABBIT_CONFIG.url}/queues/${RABBIT_CONFIG.vhost}/${queueName}/get`,
      {
        count: 1,
        ackmode: autoAck ? "ack_requeue_false" : "ack_requeue_true",
        encoding: "auto",
        truncate: 50000
      },
      { 
        auth: RABBIT_CONFIG.auth,
        timeout: 5000
      }
    );
    
    if (response.data.length > 0) {
      const message = response.data[0];
      const payload = typeof message.payload === 'string' 
        ? JSON.parse(message.payload) 
        : message.payload;
      
      console.log(`📥 [RabbitMQ] Mensaje consumido de ${queueName}:`, {
        action: payload.action,
        id: payload.reservationId || payload.orderId || payload.userId
      });
      
      return payload;
    }
    
    return null;
  } catch (error) {
    console.error(`❌ [RabbitMQ] Error consuming from ${queueName}:`, error.message);
    return null;
  }
};

// ================================================
// CONSUMIR MÚLTIPLES MENSAJES (BATCH)
// ================================================
/**
 * Consume múltiples mensajes de una cola
 * @param {string} queueName - Nombre de la cola
 * @param {number} count - Cantidad de mensajes
 * @returns {Promise<Array>}
 */
const consumeBatchFromQueue = async (queueName, count = 10) => {
  try {
    const response = await axios.post(
      `${RABBIT_CONFIG.url}/queues/${RABBIT_CONFIG.vhost}/${queueName}/get`,
      {
        count: count,
        ackmode: "ack_requeue_false",
        encoding: "auto",
        truncate: 50000
      },
      { 
        auth: RABBIT_CONFIG.auth,
        timeout: 10000
      }
    );
    
    const messages = response.data.map(msg => {
      const payload = typeof msg.payload === 'string' 
        ? JSON.parse(msg.payload) 
        : msg.payload;
      return payload;
    });
    
    if (messages.length > 0) {
      console.log(`📥 [RabbitMQ] ${messages.length} mensajes consumidos de ${queueName}`);
    }
    
    return messages;
  } catch (error) {
    console.error(`❌ [RabbitMQ] Error consuming batch from ${queueName}:`, error.message);
    return [];
  }
};

// ================================================
// VERIFICAR ESTADO DE COLA
// ================================================
/**
 * Obtiene información de una cola
 * @param {string} queueName - Nombre de la cola
 * @returns {Promise<object|null>}
 */
const getQueueInfo = async (queueName) => {
  try {
    const response = await axios.get(
      `${RABBIT_CONFIG.url}/queues/${RABBIT_CONFIG.vhost}/${queueName}`,
      { 
        auth: RABBIT_CONFIG.auth,
        timeout: 5000
      }
    );
    
    return {
      name: response.data.name,
      messages: response.data.messages,
      messages_ready: response.data.messages_ready,
      messages_unacknowledged: response.data.messages_unacknowledged,
      consumers: response.data.consumers
    };
  } catch (error) {
    console.error(`❌ [RabbitMQ] Error getting queue info for ${queueName}:`, error.message);
    return null;
  }
};

// ================================================
// CREAR COLA SI NO EXISTE
// ================================================
/**
 * Declara una cola (idempotente)
 * @param {string} queueName - Nombre de la cola
 * @param {object} options - Opciones de la cola
 * @returns {Promise<boolean>}
 */
const declareQueue = async (queueName, options = {}) => {
  try {
    await axios.put(
      `${RABBIT_CONFIG.url}/queues/${RABBIT_CONFIG.vhost}/${queueName}`,
      {
        auto_delete: false,
        durable: true,
        arguments: {},
        ...options
      },
      { 
        auth: RABBIT_CONFIG.auth,
        timeout: 5000
      }
    );
    
    console.log(`✅ [RabbitMQ] Cola declarada: ${queueName}`);
    return true;
  } catch (error) {
    console.error(`❌ [RabbitMQ] Error declaring queue ${queueName}:`, error.message);
    return false;
  }
};

// ================================================
// PURGAR COLA (BORRAR TODOS LOS MENSAJES)
// ================================================
/**
 * Elimina todos los mensajes de una cola
 * @param {string} queueName - Nombre de la cola
 * @returns {Promise<boolean>}
 */
const purgeQueue = async (queueName) => {
  try {
    await axios.delete(
      `${RABBIT_CONFIG.url}/queues/${RABBIT_CONFIG.vhost}/${queueName}/contents`,
      { 
        auth: RABBIT_CONFIG.auth,
        timeout: 5000
      }
    );
    
    console.log(`🗑️ [RabbitMQ] Cola purgada: ${queueName}`);
    return true;
  } catch (error) {
    console.error(`❌ [RabbitMQ] Error purging queue ${queueName}:`, error.message);
    return false;
  }
};

// ================================================
// HEALTHCHECK
// ================================================
/**
 * Verifica conexión con RabbitMQ
 * @returns {Promise<boolean>}
 */
const healthCheck = async () => {
  try {
    const response = await axios.get(
      `${RABBIT_CONFIG.url}/overview`,
      { 
        auth: RABBIT_CONFIG.auth,
        timeout: 3000
      }
    );
    
    console.log(`✅ [RabbitMQ] Conexión OK - Versión: ${response.data.rabbitmq_version}`);
    return true;
  } catch (error) {
    console.error(`❌ [RabbitMQ] Healthcheck failed:`, error.message);
    return false;
  }
};

module.exports = {
  publishToQueue,
  consumeFromQueue,
  consumeBatchFromQueue,
  getQueueInfo,
  declareQueue,
  purgeQueue,
  healthCheck,
  RABBIT_CONFIG
};