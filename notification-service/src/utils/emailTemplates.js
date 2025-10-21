/**
 * Template para email de tickets
 */
const ticketsEmailTemplate = (userName, concertTitle, orderData, ticketsCount) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .ticket-info {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #667eea;
    }
    .button {
      display: inline-block;
      background: #667eea;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #666;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎫 ¡Tus Tickets están Listos!</h1>
  </div>
  
  <div class="content">
    <p>Hola <strong>${userName}</strong>,</p>
    
    <p>¡Gracias por tu compra! Aquí está la confirmación de tu orden.</p>
    
    <div class="ticket-info">
      <h2>${concertTitle}</h2>
      <p><strong>Orden:</strong> #${orderData.id}</p>
      <p><strong>Tickets:</strong> ${ticketsCount}</p>
      <p><strong>Total Pagado:</strong> $${orderData.total}</p>
    </div>
    
    <p>📎 <strong>Tus tickets están adjuntos en formato PDF</strong></p>
    
    <p>Importante:</p>
    <ul>
      <li>Presenta el código QR de cada ticket en la entrada</li>
      <li>Los códigos son de un solo uso</li>
      <li>Llega 30 minutos antes del evento</li>
      <li>Guarda este email para consultar tus tickets</li>
    </ul>
    
    <p>¿Necesitas ayuda? Contáctanos a soporte@ticketapp.com</p>
    
    <p>¡Disfruta el evento! 🎉</p>
  </div>
  
  <div class="footer">
    <p>TicketApp - Sistema de Venta de Tickets</p>
    <p>Este es un email automático, por favor no respondas.</p>
  </div>
</body>
</html>
  `;
};

/**
 * Template para email de confirmación
 */
const confirmationEmailTemplate = (userName, concertTitle, orderData) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      background: #10b981;
      color: white;
      padding: 30px;
      text-align: center;
      border-radius: 10px 10px 0 0;
    }
    .content {
      background: #f9f9f9;
      padding: 30px;
      border-radius: 0 0 10px 10px;
    }
    .success-icon {
      font-size: 48px;
      text-align: center;
      margin: 20px 0;
    }
    .order-summary {
      background: white;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
    }
    .footer {
      text-align: center;
      font-size: 12px;
      color: #666;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>✅ Compra Confirmada</h1>
  </div>
  
  <div class="content">
    <div class="success-icon">🎉</div>
    
    <p>Hola <strong>${userName}</strong>,</p>
    
    <p>Tu compra ha sido procesada exitosamente.</p>
    
    <div class="order-summary">
      <h3>Resumen de la Orden</h3>
      <p><strong>Evento:</strong> ${concertTitle}</p>
      <p><strong>Orden:</strong> #${orderData.id}</p>
      <p><strong>Total:</strong> $${orderData.total}</p>
      <p><strong>Estado:</strong> Confirmada ✅</p>
    </div>
    
    <p>Recibirás tus tickets por email en los próximos minutos.</p>
    
    <p>Gracias por tu compra,<br>El equipo de TicketApp</p>
  </div>
  
  <div class="footer">
    <p>TicketApp - Sistema de Venta de Tickets</p>
  </div>
</body>
</html>
  `;
};

module.exports = {
  ticketsEmailTemplate,
  confirmationEmailTemplate,
};