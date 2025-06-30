import nodemailer from 'nodemailer';

/**
 * Send email with ZIP attachment using Gmail SMTP
 */
export async function sendEmailWithAttachment(
  zipBuffer: Buffer,
  orderId: number,
  orderDetails?: {
    customerName?: string;
    customerEmail?: string;
    totalValue?: string;
    itemCount?: number;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`Preparing to send email for order ${orderId}`);

    // Validate environment variables
    const emailFrom = process.env.EMAIL_FROM;
    const emailTo = process.env.EMAIL_TO;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!emailFrom || !emailTo || !smtpUser || !smtpPass) {
      const missingVars = [];
      if (!emailFrom) missingVars.push('EMAIL_FROM');
      if (!emailTo) missingVars.push('EMAIL_TO');
      if (!smtpUser) missingVars.push('SMTP_USER');
      if (!smtpPass) missingVars.push('SMTP_PASS');

      throw new Error(`Missing environment variables: ${missingVars.join(', ')}`);
    }

    // Create transporter
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass, // App Password, not regular password
      },
    });

    // Verify connection
    await transporter.verify();
    console.log('SMTP connection verified');

    // Prepare email content
    const subject = `Nova narudžba #${orderId} - Deklaracije`;

    let htmlContent = `
      <h2>Nova WooCommerce narudžba</h2>
      <p><strong>Broj narudžbe:</strong> #${orderId}</p>
    `;

    if (orderDetails) {
      if (orderDetails.customerName) {
        htmlContent += `<p><strong>Kupac:</strong> ${orderDetails.customerName}</p>`;
      }
      if (orderDetails.customerEmail) {
        htmlContent += `<p><strong>Email:</strong> ${orderDetails.customerEmail}</p>`;
      }
      if (orderDetails.totalValue) {
        htmlContent += `<p><strong>Ukupna vrijednost:</strong> ${orderDetails.totalValue}</p>`;
      }
      if (orderDetails.itemCount) {
        htmlContent += `<p><strong>Broj stavki:</strong> ${orderDetails.itemCount}</p>`;
      }
    }

    htmlContent += `
      <p>U prilogu se nalaze sticker PDF-ovi za deklaracije.</p>
    `;

    const textContent = `
Nova WooCommerce narudžba #${orderId}

${orderDetails?.customerName ? `Kupac: ${orderDetails.customerName}` : ''}
${orderDetails?.customerEmail ? `Email: ${orderDetails.customerEmail}` : ''}
${orderDetails?.totalValue ? `Ukupna vrijednost: ${orderDetails.totalValue}` : ''}
${orderDetails?.itemCount ? `Broj stavki: ${orderDetails.itemCount}` : ''}

U prilogu se nalaze sticker PDF-ovi za deklaracije.
    `.trim();

    // Send email
    const info = await transporter.sendMail({
      from: `"Welmora Logistics" <${emailFrom}>`,
      to: emailTo,
      subject: subject,
      text: textContent,
      html: htmlContent,
      attachments: [
        {
          filename: `deklaracije-${orderId}.zip`,
          content: zipBuffer,
          contentType: 'application/zip',
        },
      ],
    });

    console.log('Email sent successfully:', {
      messageId: info.messageId,
      orderId,
      to: emailTo,
      attachmentSize: zipBuffer.length,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
