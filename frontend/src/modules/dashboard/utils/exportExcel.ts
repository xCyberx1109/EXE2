import * as XLSX from 'xlsx';
import type { ExportReportData } from './types';
import { formatVND, formatNumber, formatDateShort } from './format';
import { APP_NAME } from '../../../shared/constants';

function autoFitColumns(ws: XLSX.WorkSheet) {
  const colWidths: { wch: number }[] = [];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    let maxLen = 10;
    for (let r = range.s.r; r <= range.e.r; r++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell?.v) {
        const len = String(cell.v).length;
        if (len > maxLen) maxLen = len;
      }
    }
    colWidths.push({ wch: Math.min(maxLen + 2, 40) });
  }
  ws['!cols'] = colWidths;
}

function applyBorderRange(ws: XLSX.WorkSheet, range: string) {
  const decoded = XLSX.utils.decode_range(range);
  const borders = {
    top: { style: 'thin' as const, color: { rgb: 'D4D4D8' } },
    bottom: { style: 'thin' as const, color: { rgb: 'D4D4D8' } },
    left: { style: 'thin' as const, color: { rgb: 'D4D4D8' } },
    right: { style: 'thin' as const, color: { rgb: 'D4D4D8' } },
  };
  for (let r = decoded.s.r; r <= decoded.e.r; r++) {
    for (let c = decoded.s.c; c <= decoded.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { v: '', t: 's' };
      ws[addr].s = { ...(ws[addr].s || {}), border: borders };
    }
  }
}

export function exportToExcel(data: ExportReportData) {
  const wb = XLSX.utils.book_new();

  wb.Props = {
    Author: APP_NAME,
    Title: `${APP_NAME} Business Report`,
    Subject: `${APP_NAME} Report`,
  };

  // Sheet 1: Summary
  const summaryRows: [string, string | number][] = [
    ['BÁO CÁO KINH DOANH', ''],
    ['', ''],
    ['Tên cửa hàng', data.storeName],
    ['Khoảng thời gian', data.reportPeriod],
    ['Thời gian tạo', data.generatedTime],
    ['', ''],
    ['TÓM TẮT KINH DOANH', ''],
    ['Doanh thu', formatVND(data.kpi.revenue)],
    ['Giá vốn', formatVND(data.kpi.cost)],
    ['Lợi nhuận', formatVND(data.kpi.profit)],
    ['Đơn hàng', formatNumber(data.kpi.orders)],
    ['Giá trị đơn TB', formatVND(data.kpi.avgOrderValue)],
  ];
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
  summaryWs['!cols'] = [{ wch: 22 }, { wch: 30 }];

  // Bold title rows
  const titleAddrs = ['A1', 'A7'];
  for (const addr of titleAddrs) {
    if (summaryWs[addr]) {
      summaryWs[addr].s = {
        font: { bold: true, sz: 14 },
      };
    }
  }
  // Bold labels
  for (let r = 2; r <= 12; r++) {
    const cell = summaryWs[`A${r + 1}`];
    if (cell && cell.v) {
      cell.s = { font: { bold: true } };
    }
  }

  XLSX.utils.book_append_sheet(wb, summaryWs, 'Tổng quan');

  // Sheet 2: Daily Revenue
  const revenueHeaders = ['Ngày', 'Doanh thu', 'Giá vốn', 'Lợi nhuận', 'Đơn hàng'];
  const revenueRows = data.revenueChart.map((pt) => [
    formatDateShort(pt.date),
    pt.revenue,
    pt.cost ?? (pt.revenue - pt.profit),
    pt.profit,
    pt.orderCount,
  ]);
  const revenueWs = XLSX.utils.aoa_to_sheet([revenueHeaders, ...revenueRows]);

  // Bold headers
  for (let c = 0; c < revenueHeaders.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (revenueWs[addr]) {
      revenueWs[addr].s = { font: { bold: true } };
    }
  }
  // Currency formatting for columns B, C, D
  for (let r = 1; r <= revenueRows.length; r++) {
    for (const col of ['B', 'C', 'D']) {
      const addr = `${col}${r + 1}`;
      if (revenueWs[addr]) {
        revenueWs[addr].z = '#,##0';
      }
    }
  }
  autoFitColumns(revenueWs);
  if (revenueRows.length > 0) {
    applyBorderRange(revenueWs, XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: revenueRows.length, c: revenueHeaders.length - 1 },
    }));
  }
  // Freeze header row
  revenueWs['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, revenueWs, 'Doanh thu theo ngày');

  // Sheet 3: Top Selling Items
  const topHeaders = ['Hạng', 'Món', 'Số lượng', 'Doanh thu', 'Giá vốn', 'Lợi nhuận'];
  const topRows = data.topItems.map((item, idx) => [
    idx + 1,
    item.name,
    item.soldQuantity,
    item.revenue,
    item.cost ?? 0,
    item.profit ?? 0,
  ]);
  const topWs = XLSX.utils.aoa_to_sheet([topHeaders, ...topRows]);

  // Bold headers
  for (let c = 0; c < topHeaders.length; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (topWs[addr]) {
      topWs[addr].s = { font: { bold: true } };
    }
  }
  // Currency formatting
  for (let r = 1; r <= topRows.length; r++) {
    for (const col of ['D', 'E', 'F']) {
      const addr = `${col}${r + 1}`;
      if (topWs[addr]) {
        topWs[addr].z = '#,##0';
      }
    }
  }
  autoFitColumns(topWs);
  if (topRows.length > 0) {
    applyBorderRange(topWs, XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: topRows.length, c: topHeaders.length - 1 },
    }));
  }
  topWs['!freeze'] = { xSplit: 0, ySplit: 1 };

  XLSX.utils.book_append_sheet(wb, topWs, 'Món bán chạy');

  // Download
  const fileName = `POSitive_Report_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
