import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { ExportReportData } from './types';
import { formatVND, formatNumber, formatDateShort } from './format';
import { APP_NAME } from '../../../shared/constants';

const FONT = 'Roboto';

let cachedFonts: { regular: string; bold: string; italic: string } | null = null;

async function ensureFonts(doc: jsPDF) {
  if (!cachedFonts) {
    const load = async (file: string) => {
      const res = await fetch(`/fonts/${file}`);
      const buf = await res.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    };

    cachedFonts = {
      regular: await load('Roboto-Regular.ttf'),
      bold: await load('Roboto-Bold.ttf'),
      italic: await load('Roboto-Italic.ttf'),
    };
  }

  doc.addFileToVFS('Roboto-Regular.ttf', cachedFonts.regular);
  doc.addFont('Roboto-Regular.ttf', FONT, 'normal');

  doc.addFileToVFS('Roboto-Bold.ttf', cachedFonts.bold);
  doc.addFont('Roboto-Bold.ttf', FONT, 'bold');

  doc.addFileToVFS('Roboto-Italic.ttf', cachedFonts.italic);
  doc.addFont('Roboto-Italic.ttf', FONT, 'italic');
}

async function loadLogoBase64(): Promise<string | null> {
  try {
    const res = await fetch('/Logo.png');
    const buf = await res.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return 'data:image/png;base64,' + btoa(bin);
  } catch {
    return null;
  }
}

export async function exportToPDF(data: ExportReportData) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  await ensureFonts(doc);

  const logoDataUrl = await loadLogoBase64();

  doc.setProperties({
    author: APP_NAME,
    creator: APP_NAME,
    subject: `${APP_NAME} Business Report`,
    title: `${APP_NAME} Report`,
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const drawLine = () => {
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  };

  const checkPageBreak = (needed: number) => {
    if (y + needed > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
      return true;
    }
    return false;
  };

  // ── Header ───────────────────────────────────────────────────
  if (logoDataUrl) {
    const logoEl = await new Promise<HTMLImageElement>((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.src = logoDataUrl;
    });
    const maxHeight = 14;
    const ratio = logoEl.naturalHeight / logoEl.naturalWidth;
    let logoH = maxHeight;
    let logoW = logoH / ratio;
    if (logoW > contentWidth * 0.35) {
      logoW = contentWidth * 0.35;
      logoH = logoW * ratio;
    }
    const logoX = (pageWidth - logoW) / 2;
    doc.addImage(logoDataUrl, 'PNG', logoX, y, logoW, logoH);
    y += logoH + 4;
  }

  doc.setFontSize(18);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('BÁO CÁO KINH DOANH', pageWidth / 2, y, { align: 'center' });
  y += 8;

  doc.setFontSize(11);
  doc.setFont(FONT, 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text(data.storeName, pageWidth / 2, y, { align: 'center' });
  y += 6;

  doc.setFontSize(9);
  doc.text(`Thời gian báo cáo: ${data.reportPeriod}`, pageWidth / 2, y, { align: 'center' });
  y += 5;
  doc.text(`Thời gian xuất: ${data.generatedTime}`, pageWidth / 2, y, { align: 'center' });
  y += 7;

  drawLine();

  // ── Business Summary ─────────────────────────────────────────
  doc.setFontSize(12);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Tổng quan kinh doanh', margin, y);
  y += 7;

  const summaryData = [
    ['Doanh thu', formatVND(data.kpi.revenue)],
    ['Giá vốn', formatVND(data.kpi.cost)],
    ['Lợi nhuận', formatVND(data.kpi.profit)],
    ['Đơn hàng', formatNumber(data.kpi.orders)],
    ['Giá trị đơn trung bình', formatVND(data.kpi.avgOrderValue)],
  ];

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [],
    body: summaryData,
    theme: 'plain',
    styles: {
      font: FONT,
      fontSize: 9,
      cellPadding: 2,
      textColor: [50, 50, 50],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 55 },
      1: { halign: 'right', cellWidth: contentWidth - 55 },
    },
  });

  y = (doc as any).lastAutoTable.finalY + 7;
  drawLine();

  // ── Revenue Chart Data (Daily Revenue Table) ─────────────────
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Doanh thu theo ngày', margin, y);
  y += 4;

  if (data.revenueChart.length > 0) {
    const revenueRows = data.revenueChart.map((pt) => [
      formatDateShort(pt.date),
      formatVND(pt.revenue),
      formatVND(pt.cost ?? (pt.revenue - pt.profit)),
      formatVND(pt.profit),
      formatNumber(pt.orderCount),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['Ngày', 'Doanh thu', 'Giá vốn', 'Lợi nhuận', 'Đơn hàng']],
      body: revenueRows,
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        font: FONT,
        fontSize: 8,
      },
      bodyStyles: {
        font: FONT,
        fontSize: 8,
        textColor: [50, 50, 50],
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { halign: 'right', cellWidth: 35 },
        2: { halign: 'right', cellWidth: 35 },
        3: { halign: 'right', cellWidth: 35 },
        4: { halign: 'center', cellWidth: 20 },
      },
      didDrawPage: (hookData) => {
        y = hookData.cursor?.y ?? y;
      },
    });

    y = (doc as any).lastAutoTable.finalY + 7;
  } else {
    doc.setFontSize(9);
    doc.setFont(FONT, 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('Không có dữ liệu doanh thu', margin, y + 5);
    y += 10;
  }

  drawLine();

  // ── Top Selling Items ────────────────────────────────────────
  checkPageBreak(20);
  doc.setFontSize(12);
  doc.setFont(FONT, 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text('Món bán chạy', margin, y);
  y += 4;

  if (data.topItems.length > 0) {
    const topRows = data.topItems.map((item, idx) => [
      String(idx + 1),
      item.name,
      formatNumber(item.soldQuantity),
      formatVND(item.revenue),
      formatVND(item.cost ?? 0),
      formatVND(item.profit ?? 0),
    ]);

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [['STT', 'Tên món', 'Đã bán', 'Doanh thu', 'Giá vốn', 'Lợi nhuận']],
      body: topRows,
      headStyles: {
        fillColor: [30, 30, 30],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        font: FONT,
        fontSize: 8,
      },
      bodyStyles: {
        font: FONT,
        fontSize: 8,
        textColor: [50, 50, 50],
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        1: { cellWidth: 40 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'right', cellWidth: 30 },
        4: { halign: 'right', cellWidth: 28 },
        5: { halign: 'right', cellWidth: 28 },
      },
      didDrawPage: (hookData) => {
        y = hookData.cursor?.y ?? y;
      },
    });

    y = (doc as any).lastAutoTable.finalY + 7;
  } else {
    doc.setFontSize(9);
    doc.setFont(FONT, 'italic');
    doc.setTextColor(150, 150, 150);
    doc.text('Không có dữ liệu bán hàng', margin, y + 5);
    y += 10;
  }

  drawLine();

  // ── Footer ───────────────────────────────────────────────────
  const pageH = doc.internal.pageSize.getHeight();
  const footerY = pageH - margin + 2;

  doc.setFontSize(8);
  doc.setFont(FONT, 'normal');
  doc.setTextColor(150, 150, 150);
  doc.text(`Xuất bởi: ${APP_NAME}`, margin, footerY);

  // Page numbers on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont(FONT, 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text(`Trang ${i} / ${totalPages}`, pageWidth - margin, footerY, { align: 'right' });
  }

  // Download
  const fileName = `POSitive_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
