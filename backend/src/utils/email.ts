import nodemailer from 'nodemailer';
import { db, toDate } from './firestore';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export interface ReservationEmailData {
  reservationNumber: string;
  guestName: string;
  guestEmail: string;
  checkInDate: Date;
  checkOutDate: Date;
  roomNumber: string;
  roomType?: string;
  rate: number;
  adults: number;
  children: number;
  specialRequests?: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  cancellationPolicy?: string;
}

export interface PaymentReceiptData {
  guestName: string;
  guestEmail: string;
  reservationNumber?: string;
  paymentAmount: number;
  paymentMethod: string;
  paymentDate: Date;
  transactionId: string;
  propertyName: string;
  propertyAddress?: string;
  propertyPhone?: string;
  propertyEmail?: string;
  description?: string;
}

let transporter: nodemailer.Transporter | null = null;

const initializeTransporter = () => {
  if (transporter) return transporter;

  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPassword = process.env.SMTP_PASSWORD || '';
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  if (!smtpUser || !smtpPassword) {
    console.warn('Email service not configured. SMTP credentials missing.');
    return null;
  }

  transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: {
      user: smtpUser,
      pass: smtpPassword,
    },
  });

  return transporter;
};

export const sendEmail = async (options: EmailOptions): Promise<boolean> => {
  try {
    const emailTransporter = initializeTransporter();
    if (!emailTransporter) {
      console.warn('Email transporter not initialized. Skipping email send.');
      return false;
    }

    const from = options.from || process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@innsight.com';

    const mailOptions = {
      from,
      to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || options.html.replace(/<[^>]*>/g, ''),
    };

    const info = await emailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return false;
  }
};

const formatCurrency = (amount: number, currency: string = 'NGN'): string => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
  }).format(amount);
};

const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);
};

export const generateReservationConfirmationEmail = (data: ReservationEmailData): string => {
  const checkInFormatted = formatDate(data.checkInDate);
  const checkOutFormatted = formatDate(data.checkOutDate);
  const totalNights = Math.ceil((data.checkOutDate.getTime() - data.checkInDate.getTime()) / (1000 * 60 * 60 * 24));
  const totalAmount = data.rate * totalNights;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reservation Confirmation</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #007bff;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #007bff;
      margin: 0;
      font-size: 24px;
    }
    .reservation-number {
      background-color: #f8f9fa;
      padding: 15px;
      border-radius: 4px;
      text-align: center;
      margin-bottom: 20px;
    }
    .reservation-number strong {
      font-size: 18px;
      color: #007bff;
    }
    .info-section {
      margin-bottom: 25px;
    }
    .info-section h2 {
      color: #333;
      font-size: 18px;
      margin-bottom: 10px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-label {
      font-weight: 600;
      color: #666;
    }
    .info-value {
      color: #333;
      text-align: right;
    }
    .highlight {
      background-color: #fff3cd;
      padding: 15px;
      border-left: 4px solid #ffc107;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
    .total-amount {
      background-color: #007bff;
      color: white;
      padding: 15px;
      border-radius: 4px;
      text-align: center;
      margin: 20px 0;
      font-size: 20px;
      font-weight: bold;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${data.propertyName}</h1>
      <p>Reservation Confirmation</p>
    </div>

    <div class="reservation-number">
      <strong>Confirmation Number: ${data.reservationNumber}</strong>
    </div>

    <div class="info-section">
      <h2>Guest Information</h2>
      <div class="info-row">
        <span class="info-label">Guest Name:</span>
        <span class="info-value">${data.guestName}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Email:</span>
        <span class="info-value">${data.guestEmail}</span>
      </div>
    </div>

    <div class="info-section">
      <h2>Reservation Details</h2>
      <div class="info-row">
        <span class="info-label">Check-In:</span>
        <span class="info-value">${checkInFormatted}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Check-Out:</span>
        <span class="info-value">${checkOutFormatted}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Nights:</span>
        <span class="info-value">${totalNights}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Room:</span>
        <span class="info-value">${data.roomNumber}${data.roomType ? ` (${data.roomType})` : ''}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Guests:</span>
        <span class="info-value">${data.adults} Adult(s)${data.children > 0 ? `, ${data.children} Child(ren)` : ''}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Rate per Night:</span>
        <span class="info-value">${formatCurrency(data.rate)}</span>
      </div>
    </div>

    <div class="total-amount">
      Total Amount: ${formatCurrency(totalAmount)}
    </div>

    ${data.specialRequests ? `
    <div class="info-section">
      <h2>Special Requests</h2>
      <p>${data.specialRequests}</p>
    </div>
    ` : ''}

    <div class="highlight">
      <strong>Important:</strong> Please keep this confirmation for your records. 
      ${data.cancellationPolicy ? `<br><br>${data.cancellationPolicy}` : 'Contact us if you need to modify or cancel your reservation.'}
    </div>

    <div class="info-section">
      <h2>Contact Information</h2>
      ${data.propertyAddress ? `<p><strong>Address:</strong> ${data.propertyAddress}</p>` : ''}
      ${data.propertyPhone ? `<p><strong>Phone:</strong> ${data.propertyPhone}</p>` : ''}
      ${data.propertyEmail ? `<p><strong>Email:</strong> ${data.propertyEmail}</p>` : ''}
    </div>

    <div class="footer">
      <p>Thank you for choosing ${data.propertyName}!</p>
      <p>We look forward to hosting you.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

export const generateCheckInReminderEmail = (data: ReservationEmailData): string => {
  const checkInFormatted = formatDate(data.checkInDate);
  const totalNights = Math.ceil((data.checkOutDate.getTime() - data.checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Check-In Reminder</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #28a745;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #28a745;
      margin: 0;
      font-size: 24px;
    }
    .reminder-box {
      background-color: #d4edda;
      padding: 20px;
      border-left: 4px solid #28a745;
      border-radius: 4px;
      margin: 20px 0;
    }
    .info-section {
      margin-bottom: 25px;
    }
    .info-section h2 {
      color: #333;
      font-size: 18px;
      margin-bottom: 10px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-label {
      font-weight: 600;
      color: #666;
    }
    .info-value {
      color: #333;
      text-align: right;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Check-In Reminder</h1>
    </div>

    <p>Dear ${data.guestName},</p>

    <div class="reminder-box">
      <p><strong>We're excited to welcome you!</strong></p>
      <p>Your check-in is scheduled for <strong>${checkInFormatted}</strong></p>
    </div>

    <div class="info-section">
      <h2>Your Reservation</h2>
      <div class="info-row">
        <span class="info-label">Confirmation Number:</span>
        <span class="info-value">${data.reservationNumber}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Room:</span>
        <span class="info-value">${data.roomNumber}${data.roomType ? ` (${data.roomType})` : ''}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Stay Duration:</span>
        <span class="info-value">${totalNights} Night(s)</span>
      </div>
      <div class="info-row">
        <span class="info-label">Check-Out:</span>
        <span class="info-value">${formatDate(data.checkOutDate)}</span>
      </div>
    </div>

    <div class="info-section">
      <h2>Contact Information</h2>
      ${data.propertyAddress ? `<p><strong>Address:</strong> ${data.propertyAddress}</p>` : ''}
      ${data.propertyPhone ? `<p><strong>Phone:</strong> ${data.propertyPhone}</p>` : ''}
      ${data.propertyEmail ? `<p><strong>Email:</strong> ${data.propertyEmail}</p>` : ''}
    </div>

    <div class="footer">
      <p>We look forward to hosting you at ${data.propertyName}!</p>
      <p>Safe travels!</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

export const generateCheckOutThankYouEmail = (data: ReservationEmailData & { totalCharges?: number }): string => {
  const totalNights = Math.ceil((data.checkOutDate.getTime() - data.checkInDate.getTime()) / (1000 * 60 * 60 * 24));

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Thank You</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #28a745;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #28a745;
      margin: 0;
      font-size: 24px;
    }
    .thank-you-box {
      background-color: #d4edda;
      padding: 20px;
      border-left: 4px solid #28a745;
      border-radius: 4px;
      margin: 20px 0;
      text-align: center;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Thank You!</h1>
    </div>

    <p>Dear ${data.guestName},</p>

    <div class="thank-you-box">
      <p><strong>Thank you for staying with us!</strong></p>
      <p>We hope you enjoyed your ${totalNights} night(s) stay at ${data.propertyName}.</p>
    </div>

    <p>We value your feedback and would love to hear about your experience. Your satisfaction is our priority.</p>

    <p>We look forward to welcoming you back soon!</p>

    <div class="footer">
      <p><strong>${data.propertyName}</strong></p>
      ${data.propertyAddress ? `<p>${data.propertyAddress}</p>` : ''}
      ${data.propertyPhone ? `<p>Phone: ${data.propertyPhone}</p>` : ''}
      ${data.propertyEmail ? `<p>Email: ${data.propertyEmail}</p>` : ''}
      <p style="margin-top: 20px;">Safe travels!</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

export const generatePaymentReceiptEmail = (data: PaymentReceiptData): string => {
  const paymentDateFormatted = formatDate(data.paymentDate);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Payment Receipt</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
      background-color: #f5f5f5;
    }
    .container {
      background-color: #ffffff;
      border-radius: 8px;
      padding: 30px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .header {
      text-align: center;
      border-bottom: 2px solid #28a745;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #28a745;
      margin: 0;
      font-size: 24px;
    }
    .receipt-box {
      background-color: #f8f9fa;
      padding: 20px;
      border-radius: 4px;
      margin: 20px 0;
      text-align: center;
    }
    .amount {
      font-size: 32px;
      font-weight: bold;
      color: #28a745;
      margin: 10px 0;
    }
    .info-section {
      margin-bottom: 25px;
    }
    .info-section h2 {
      color: #333;
      font-size: 18px;
      margin-bottom: 10px;
      border-bottom: 1px solid #eee;
      padding-bottom: 5px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    .info-label {
      font-weight: 600;
      color: #666;
    }
    .info-value {
      color: #333;
      text-align: right;
    }
    .footer {
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid #eee;
      text-align: center;
      color: #666;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Payment Receipt</h1>
      <p>${data.propertyName}</p>
    </div>

    <div class="receipt-box">
      <p>Payment Successful</p>
      <div class="amount">${formatCurrency(data.paymentAmount)}</div>
      <p style="color: #666; margin: 0;">Transaction ID: ${data.transactionId}</p>
    </div>

    <div class="info-section">
      <h2>Payment Details</h2>
      <div class="info-row">
        <span class="info-label">Guest Name:</span>
        <span class="info-value">${data.guestName}</span>
      </div>
      ${data.reservationNumber ? `
      <div class="info-row">
        <span class="info-label">Reservation Number:</span>
        <span class="info-value">${data.reservationNumber}</span>
      </div>
      ` : ''}
      <div class="info-row">
        <span class="info-label">Payment Date:</span>
        <span class="info-value">${paymentDateFormatted}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Payment Method:</span>
        <span class="info-value">${data.paymentMethod.replace(/_/g, ' ').toUpperCase()}</span>
      </div>
      ${data.description ? `
      <div class="info-row">
        <span class="info-label">Description:</span>
        <span class="info-value">${data.description}</span>
      </div>
      ` : ''}
    </div>

    <div class="info-section">
      <h2>Property Information</h2>
      ${data.propertyAddress ? `<p><strong>Address:</strong> ${data.propertyAddress}</p>` : ''}
      ${data.propertyPhone ? `<p><strong>Phone:</strong> ${data.propertyPhone}</p>` : ''}
      ${data.propertyEmail ? `<p><strong>Email:</strong> ${data.propertyEmail}</p>` : ''}
    </div>

    <div class="footer">
      <p>Thank you for your payment!</p>
      <p>Please keep this receipt for your records.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
};

export const getTenantEmailSettings = async (tenantId: string) => {
  try {
    const tenantDoc = await db.collection('tenants').doc(tenantId).get();
    if (!tenantDoc.exists) {
      return null;
    }

    const tenantData = tenantDoc.data();
    return {
      propertyName: tenantData?.name || 'InnSight Property',
      propertyAddress: tenantData?.address || null,
      propertyPhone: tenantData?.phone || null,
      propertyEmail: tenantData?.email || null,
      branding: tenantData?.branding || null,
    };
  } catch (error) {
    console.error('Error fetching tenant email settings:', error);
    return null;
  }
};

