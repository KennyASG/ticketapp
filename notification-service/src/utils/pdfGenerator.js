const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");

/**
 * Generar PDF con tickets
 */
const generateTicketsPDF = async (orderData, concertData, tickets) => {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      // Header
      doc
        .fontSize(25)
        .font("Helvetica-Bold")
        .text("TUS TICKETS", { align: "center" });

      doc.moveDown();

      // Información del concierto
      doc.fontSize(18).text(concertData.title, { align: "center" });
      doc
        .fontSize(12)
        .font("Helvetica")
        .text(`Fecha: ${new Date(concertData.date).toLocaleString("es-ES")}`, {
          align: "center",
        });
      doc.text(`Lugar: ${concertData.venue}`, { align: "center" });

      doc.moveDown(2);

      // Información de la orden
      doc
        .fontSize(10)
        .text(`Orden #${orderData.id}`, 50, doc.y)
        .text(`Total: $${orderData.total}`, 400, doc.y - 12);

      doc.moveDown();
      doc
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke();
      doc.moveDown();

      // Generar cada ticket
      for (let i = 0; i < tickets.length; i++) {
        const ticket = tickets[i];

        // Nueva página para cada ticket (excepto el primero)
        if (i > 0) {
          doc.addPage();
        }

        doc.fontSize(16).font("Helvetica-Bold").text(`TICKET ${i + 1}`, {
          align: "center",
        });

        doc.moveDown();

        // Información del ticket
        doc
          .fontSize(12)
          .font("Helvetica")
          .text(`Tipo: ${ticket.type_name}`, 50, doc.y);
        doc.text(`Precio: $${ticket.price}`, 50, doc.y);

        if (ticket.seat_number) {
          doc.text(`Asiento: ${ticket.seat_number}`, 50, doc.y);
          doc.text(`Sección: ${ticket.section_name}`, 50, doc.y);
        }

        doc.moveDown();

        // Código del ticket
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .text("Código:", 50, doc.y);
        doc
          .fontSize(8)
          .font("Courier")
          .text(ticket.code, 50, doc.y);

        doc.moveDown();

        // Generar QR code
        try {
          const qrCodeDataUrl = await QRCode.toDataURL(ticket.code, {
            width: 200,
            margin: 1,
          });

          // Convertir data URL a buffer
          const base64Data = qrCodeDataUrl.replace(
            /^data:image\/png;base64,/,
            ""
          );
          const qrBuffer = Buffer.from(base64Data, "base64");

          // Insertar QR en el PDF
          doc.image(qrBuffer, 200, doc.y, {
            width: 150,
            align: "center",
          });

          doc.moveDown(12);
        } catch (qrError) {
          console.error("Error generando QR:", qrError);
          doc.text("QR no disponible", { align: "center" });
        }

        // Instrucciones
        doc
          .fontSize(10)
          .font("Helvetica")
          .text("Instrucciones:", 50, doc.y);
        doc
          .fontSize(9)
          .text("• Presenta este código QR en la entrada del evento", 50, doc.y);
        doc.text("• El código es de un solo uso", 50, doc.y);
        doc.text("• Llegue 30 minutos antes del evento", 50, doc.y);

        doc.moveDown();
        doc
          .moveTo(50, doc.y)
          .lineTo(550, doc.y)
          .stroke();
      }

      // Footer en última página
      doc
        .fontSize(8)
        .font("Helvetica")
        .text("TicketApp - Sistema de Venta de Tickets", 50, 750, {
          align: "center",
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
};

module.exports = { generateTicketsPDF };