export function printFolio(folio: any) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Folio Receipt - ${folio.guestName}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: Arial, sans-serif;
            padding: 2rem;
            color: #333;
          }
          .header {
            text-align: center;
            margin-bottom: 2rem;
            border-bottom: 2px solid #333;
            padding-bottom: 1rem;
          }
          .header h1 {
            font-size: 24px;
            margin-bottom: 0.5rem;
          }
          .header p {
            font-size: 14px;
            color: #666;
          }
          .info-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 2rem;
            margin-bottom: 2rem;
          }
          .info-group h3 {
            font-size: 14px;
            color: #666;
            margin-bottom: 0.5rem;
            text-transform: uppercase;
          }
          .info-group p {
            font-size: 16px;
            font-weight: 500;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 1.5rem;
          }
          table th {
            background: #f5f5f5;
            padding: 0.75rem;
            text-align: left;
            border-bottom: 2px solid #333;
            font-size: 12px;
            text-transform: uppercase;
          }
          table td {
            padding: 0.75rem;
            border-bottom: 1px solid #ddd;
            font-size: 14px;
          }
          .totals {
            margin-top: 1rem;
            text-align: right;
          }
          .totals-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 0.5rem;
          }
          .totals-label {
            width: 150px;
            text-align: right;
            font-weight: 500;
          }
          .totals-value {
            width: 120px;
            text-align: right;
            font-weight: 600;
          }
          .grand-total {
            font-size: 18px;
            border-top: 2px solid #333;
            padding-top: 0.5rem;
            margin-top: 0.5rem;
          }
          .footer {
            margin-top: 3rem;
            text-align: center;
            font-size: 12px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 1rem;
          }
          @media print {
            body {
              padding: 1rem;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>InnSight PMS</h1>
          <p>Folio Receipt</p>
        </div>

        <div class="info-section">
          <div class="info-group">
            <h3>Guest Information</h3>
            <p>${folio.guestName}</p>
            ${folio.room ? `<p>Room: ${folio.room.roomNumber}</p>` : ''}
          </div>
          <div class="info-group">
            <h3>Folio Details</h3>
            <p>Folio #: ${folio.folioNumber || folio.id.substring(0, 8)}</p>
            <p>Status: ${folio.status.toUpperCase()}</p>
            <p>Date: ${new Date(folio.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <h3 style="margin-bottom: 1rem;">Charges</h3>
        <table>
          <thead>
            <tr>
              <th>Description</th>
              <th>Category</th>
              <th>Quantity</th>
              <th>Amount</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${folio.charges && folio.charges.length > 0
              ? folio.charges
                  .map(
                    (charge: any) => `
              <tr>
                <td>${charge.description}</td>
                <td>${charge.category.replace('_', ' ')}</td>
                <td>${charge.quantity}</td>
                <td>₦${Number(charge.amount).toLocaleString()}</td>
                <td>₦${Number(charge.total).toLocaleString()}</td>
              </tr>
            `
                  )
                  .join('')
              : '<tr><td colspan="5" style="text-align: center; padding: 2rem;">No charges</td></tr>'}
          </tbody>
        </table>

        <h3 style="margin-bottom: 1rem;">Payments</h3>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Method</th>
              <th>Reference</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${folio.payments && folio.payments.length > 0
              ? folio.payments
                  .map(
                    (payment: any) => `
              <tr>
                <td>${new Date(payment.createdAt).toLocaleDateString()}</td>
                <td>${payment.method.replace('_', ' ').toUpperCase()}</td>
                <td>${payment.reference || '-'}</td>
                <td>₦${Number(payment.amount).toLocaleString()}</td>
              </tr>
            `
                  )
                  .join('')
              : '<tr><td colspan="4" style="text-align: center; padding: 2rem;">No payments</td></tr>'}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span class="totals-label">Total Charges:</span>
            <span class="totals-value">₦${Number(folio.totalCharges || 0).toLocaleString()}</span>
          </div>
          <div class="totals-row">
            <span class="totals-label">Total Payments:</span>
            <span class="totals-value">₦${Number(folio.totalPayments || 0).toLocaleString()}</span>
          </div>
          <div class="totals-row grand-total">
            <span class="totals-label">Balance:</span>
            <span class="totals-value">₦${Number(folio.balance || 0).toLocaleString()}</span>
          </div>
        </div>

        <div class="footer">
          <p>Thank you for your stay!</p>
          <p>Generated on ${new Date().toLocaleString()}</p>
        </div>

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

