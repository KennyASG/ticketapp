const { healthCheck, declareQueue, getQueueInfo } = require('./src/workers/rabbitClient');

async function test() {
  console.log('🐰 Testing RabbitMQ connection...\n');
  
  // 1. Health check
  const health = await healthCheck();
  console.log(`Health: ${health ? '✅' : '❌'}\n`);
  
  // 2. Verificar colas
  const queues = ['reserva', 'carrito'];
  
  for (const queue of queues) {
    const info = await getQueueInfo(queue);
    if (info) {
      console.log(`✅ ${queue}:`);
      console.log(`   - Messages: ${info.messages}`);
      console.log(`   - Ready: ${info.messages_ready}`);
      console.log(`   - Consumers: ${info.consumers}\n`);
    } else {
      console.log(`❌ ${queue}: Not found\n`);
    }
  }
}

test();