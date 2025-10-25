const axios = require('axios');

const RABBIT_URL = 'http://ingeniebrios.work.gd:31672/api';
const AUTH = {
  username: 'apiuser',
  password: 'apiuser'
};

const publishToQueue = async (queueName, payload) => {
  console.log(queueName,payload);
  try {
    const response = await axios.post(
      `${RABBIT_URL}/exchanges/%2f/amq.default/publish`,
      {
        properties: {},
        routing_key: queueName,
        payload: payload,
        payload_encoding: "string"
      },
      { auth: AUTH }
    );

    console.log(response);
  } catch (error) {
    throw new Error(`Error publishing to ${queueName}: ${error.message}`);
  }
};

const consumeFromQueue = async (queueName) => {
  try {
    const response = await axios.post(
      `${RABBIT_URL}/queues/%2f/${queueName}/get`,
      {
        count: 1,
        ackmode: "ack_requeue_false",
        encoding: "auto",
        truncate: 50000
      },
      { auth: AUTH }
    );
    
    return response.data.length > 0 ? response.data[0].payload : null;
  } catch (error) {
    throw new Error(`Error consuming from ${queueName}: ${error.message}`);
  }
};

module.exports = { publishToQueue, consumeFromQueue };