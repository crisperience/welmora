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
): Promise<{ success: boolean; error?: string; messageId?: string; debug?: Record<string, unknown> }> {
  try {
    console.log(`=== EMAIL SERVICE START ===`);
    console.log(`Preparing to send email for order ${orderId}`);
    console.log(`ZIP buffer size: ${zipBuffer.length} bytes`);

    // Validate environment variables
    const emailFrom = process.env.EMAIL_FROM;
    const emailTo = process.env.EMAIL_TO;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    console.log('Environment variables check:', {
      emailFrom: emailFrom ? `${emailFrom.substring(0, 5)}...` : 'MISSING',
      emailTo: emailTo ? `${emailTo.substring(0, 5)}...` : 'MISSING',
      smtpUser: smtpUser ? `${smtpUser.substring(0, 5)}...` : 'MISSING',
      smtpPass: smtpPass ? `${smtpPass.substring(0, 4)}...` : 'MISSING',
    });

    if (!emailFrom || !emailTo || !smtpUser || !smtpPass) {
      const missingVars = [];
      if (!emailFrom) missingVars.push('EMAIL_FROM');
      if (!emailTo) missingVars.push('EMAIL_TO');
      if (!smtpUser) missingVars.push('SMTP_USER');
      if (!smtpPass) missingVars.push('SMTP_PASS');

      const error = `Missing environment variables: ${missingVars.join(', ')}`;
      console.error('❌ Environment validation failed:', error);
      throw new Error(error);
    }

    // Create transporter with detailed configuration
    const transporterConfig = {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass, // App Password, not regular password
      },
      debug: true, // Enable debug logging
      logger: true, // Enable logger
    };

    console.log('Creating SMTP transporter with config:', {
      host: transporterConfig.host,
      port: transporterConfig.port,
      secure: transporterConfig.secure,
      user: transporterConfig.auth.user,
    });

    const transporter = nodemailer.createTransport(transporterConfig);

    // Verify connection with detailed error handling
    console.log('Verifying SMTP connection...');
    try {
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('❌ SMTP connection verification failed:', verifyError);
      throw new Error(`SMTP verification failed: ${verifyError instanceof Error ? verifyError.message : 'Unknown error'}`);
    }

    // Prepare email content
    const subject = `Nova narudžba #${orderId} - Deklaracije`;

    let htmlContent = `
      <h2>Nova WooCommerce narudžba</h2>
      <p><strong>Broj narudžbe:</strong> #${orderId}</p>
      <p><strong>Vrijeme:</strong> ${new Date().toLocaleString('hr-HR')}</p>
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
      <p><em>Automatski poslano iz Welmora sistema</em></p>
    `;

    const textContent = `
Nova WooCommerce narudžba #${orderId}
Vrijeme: ${new Date().toLocaleString('hr-HR')}

${orderDetails?.customerName ? `Kupac: ${orderDetails.customerName}` : ''}
${orderDetails?.customerEmail ? `Email: ${orderDetails.customerEmail}` : ''}
${orderDetails?.totalValue ? `Ukupna vrijednost: ${orderDetails.totalValue}` : ''}
${orderDetails?.itemCount ? `Broj stavki: ${orderDetails.itemCount}` : ''}

U prilogu se nalaze sticker PDF-ovi za deklaracije.

Automatski poslano iz Welmora sistema
    `.trim();

    // Prepare email options
    const mailOptions = {
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
    };

    console.log('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
      attachmentCount: mailOptions.attachments.length,
      attachmentSize: zipBuffer.length,
    });

    // Send email with detailed error handling
    let info;
    try {
      info = await transporter.sendMail(mailOptions);
      console.log('✅ Email sent successfully');
    } catch (sendError) {
      console.error('❌ Email sending failed:', sendError);
      throw new Error(`Email sending failed: ${sendError instanceof Error ? sendError.message : 'Unknown error'}`);
    }

    const result = {
      messageId: info.messageId,
      orderId,
      to: emailTo,
      from: emailFrom,
      subject,
      attachmentSize: zipBuffer.length,
      timestamp: new Date().toISOString(),
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    };

    console.log('Email sent successfully with details:', result);
    console.log(`=== EMAIL SERVICE END ===`);

    return {
      success: true,
      messageId: info.messageId,
      debug: result
    };
  } catch (error) {
    console.error('❌ Email service error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    console.log(`=== EMAIL SERVICE END (ERROR) ===`);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      debug: {
        timestamp: new Date().toISOString(),
        orderId,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      }
    };
  }
}
