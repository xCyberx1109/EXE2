export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface ReceiptData {
  businessName?: string;
  branchName?: string;
  address?: string;
  phone?: string;
  invoiceNumber: string;
  checkoutDate: string;
  tableCode?: string;
  tableType?: string;
  sessionStart?: string;
  sessionEnd?: string;
  durationMinutes?: number;
  hourlyRate?: number;
  tableFee?: number;
  items: ReceiptLineItem[];
  foodTotal: number;
  serviceCharge?: number;
  tax?: number;
  discount?: number;
  grandTotal: number;
}

export function printReceipt(data: ReceiptData): void {
  const fmt = (n: number) => n.toLocaleString() + '₫';
  const hasItems = data.items.length > 0;
  const isBilliard = !!data.tableCode;

  const itemsHtml = hasItems
    ? `<table class="items">
         <thead><tr><th>Item</th><th class="qty">Qty</th><th class="price">Price</th><th class="total">Total</th></tr></thead>
         <tbody>
           ${data.items.map(i => `<tr><td>${i.name}</td><td class="qty">${i.quantity}</td><td class="price">${fmt(i.unitPrice)}</td><td class="total">${fmt(i.total)}</td></tr>`).join('')}
         </tbody>
       </table>`
    : '<p class="empty">No items</p>';

  let billiardHtml = '';
  if (isBilliard) {
    const start = data.sessionStart ? new Date(data.sessionStart) : null;
    const mins = data.durationMinutes || 0;
    const rate = data.hourlyRate ?? 0;

    billiardHtml = `<hr />
  <div class="section-title">BILLIARD SESSION</div>
  <div class="row"><span>Table</span><span>${data.tableCode}</span></div>
  <div class="row"><span>Type</span><span>${data.tableType || ''}</span></div>
  <div class="row"><span>Started</span><span>${start ? start.toLocaleTimeString() : ''}</span></div>
  <div class="row"><span>Booked Duration</span><span>${mins} minutes</span></div>
  <div class="row"><span>Hourly Rate</span><span>${fmt(Math.round(rate))} / hour</span></div>
  <div class="row" style="font-weight:bold"><span>Playing Cost</span><span>${fmt(data.tableFee || 0)}</span></div>
  <hr />
  <div class="section-title">FOOD & DRINK</div>
  ${hasItems ? itemsHtml : '<div class="row"><span>No items</span><span>0₫</span></div>'}
  <hr />
  <div class="totals">
    <div class="row"><span>Food & Drink</span><span>${fmt(data.foodTotal)}</span></div>
    <div class="row grand"><span>Grand Total</span><span>${fmt(data.grandTotal)}</span></div>
  </div>`;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Invoice ${data.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; color: #000; width: 80mm; padding: 10px; margin: 0 auto; }
    .header { text-align: center; margin-bottom: 12px; }
    .header h1 { font-size: 16px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
    .header .sub { font-size: 11px; margin-top: 2px; color: #333; }
    .header .info { font-size: 10px; color: #555; margin-top: 1px; }
    hr { border: none; border-top: 1px dashed #000; margin: 8px 0; }
    .section-title { font-weight: bold; font-size: 11px; margin-bottom: 4px; text-align: center; }
    .row { display: flex; justify-content: space-between; font-size: 11px; padding: 1px 0; }
    table.items { width: 100%; border-collapse: collapse; font-size: 11px; }
    table.items th { text-align: left; border-bottom: 1px solid #000; padding: 2px 0; font-size: 10px; }
    table.items th.qty, table.items th.price, table.items th.total { text-align: right; }
    table.items td { padding: 2px 0; vertical-align: top; }
    table.items td.qty { text-align: right; }
    table.items td.price { text-align: right; }
    table.items td.total { text-align: right; }
    .empty { text-align: center; font-size: 10px; color: #888; padding: 8px 0; }
    .totals { margin-top: 4px; }
    .totals .row { font-size: 11px; padding: 2px 0; }
    .totals .grand { font-size: 13px; font-weight: bold; border-top: 1px solid #000; padding-top: 4px; margin-top: 2px; }
    .footer { text-align: center; margin-top: 12px; font-size: 10px; color: #555; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${data.businessName || ''}</h1>
    ${data.branchName ? `<div class="sub">${data.branchName}</div>` : ''}
    ${data.address ? `<div class="info">${data.address}</div>` : ''}
    ${data.phone ? `<div class="info">Tel: ${data.phone}</div>` : ''}
  </div>
  <hr />
  <div class="section-title">INVOICE</div>
  <div class="row"><span>Invoice #</span><span>${data.invoiceNumber}</span></div>
  <div class="row"><span>Date</span><span>${new Date(data.checkoutDate).toLocaleDateString()} ${new Date(data.checkoutDate).toLocaleTimeString()}</span></div>
  ${isBilliard ? billiardHtml : `
  ${hasItems ? `<hr /><div class="section-title">ITEMS</div>${itemsHtml}` : ''}
  <hr />
  <div class="totals">
    ${hasItems ? `<div class="row"><span>Items</span><span>${fmt(data.foodTotal)}</span></div>` : ''}
    ${data.serviceCharge ? `<div class="row"><span>Service Charge</span><span>${fmt(data.serviceCharge)}</span></div>` : ''}
    ${data.tax ? `<div class="row"><span>Tax</span><span>${fmt(data.tax)}</span></div>` : ''}
    ${data.discount ? `<div class="row"><span>Discount</span><span>-${fmt(data.discount)}</span></div>` : ''}
    <div class="row grand"><span>Grand Total</span><span>${fmt(data.grandTotal)}</span></div>
  </div>`}
  <hr />
  <div class="footer">
    <p>Thank you!</p>
    <p>${data.businessName || ''}</p>
  </div>
</body>
</html>`;

  const receiptWindow = window.open('', '_blank', 'width=420,height=640');
  if (!receiptWindow) return;
  receiptWindow.document.write(html);
  receiptWindow.document.close();
  receiptWindow.print();
}
