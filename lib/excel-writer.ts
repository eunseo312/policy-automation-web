import * as XLSX from 'xlsx';
import type { AnalysisResult, BrandResult } from './analyze';

function brandSummaryRows(b: BrandResult): string[][] {
  const rows: string[][] = [];
  if (b.error) {
    rows.push([b.brand, b.channel, '오류', b.error, '', '', '', '']);
    return rows;
  }
  const newProd = b.newProducts.map((p) => `${p.name}(${p.model})`).join('\n') || '없음';
  const feeChange =
    b.feeUp || b.feeDown
      ? `인상 ${b.feeUp}건 / 인하 ${b.feeDown}건`
      : '변동 없음';
  const 타사보상 = `${b.타사보상Cur}건 (전월 ${b.타사보상Prev}건)`;
  const pkg = `${b.pkgCur}건 (전월 ${b.pkgPrev}건)`;
  const promo = b.promoCur.join(', ') || '없음';
  const hp =
    b.halfpriceCur.length
      ? `당월: ${b.halfpriceCur.join('/')}개월 / 전월: ${b.halfpricePrev.join('/')}개월`
      : '';

  rows.push([
    b.brand,
    b.channel,
    `신규제품 ${b.newProducts.length}건`,
    newProd,
    feeChange,
    b.channel === 'DCP' ? 타사보상 : '-',
    b.channel === 'DCP' ? pkg : '-',
    b.channel === 'DCP' ? (hp || '-') : promo,
  ]);
  return rows;
}

export function buildExcel(result: AnalysisResult): Buffer {
  const wb = XLSX.utils.book_new();

  // ── 요약 시트 ──────────────────────────────────────────
  const header = [
    '브랜드', '채널', '변동 요약', '신규 제품',
    '월요금 변동', '타사보상', '패키지', '프로모션/반값기간',
  ];
  const data: string[][] = [header];

  // DCP
  data.push(['[ DCP 채널 ]', '', '', '', '', '', '', '']);
  for (const b of result.brands.filter((b) => b.channel === 'DCP')) {
    data.push(...brandSummaryRows(b));
  }

  // BM2
  data.push(['[ BM2 채널 ]', '', '', '', '', '', '', '']);
  for (const b of result.brands.filter((b) => b.channel === 'BM2')) {
    data.push(...brandSummaryRows(b));
  }

  // 통계 행
  data.push([]);
  data.push([
    `분석 기준월: ${result.month}월 (전월: ${result.prevMonth}월)`,
    '',
    `총 신규제품 ${result.totalNewProducts}건`,
    `총 요금변동 ${result.totalFeeChanges}건`,
    '',
    '',
    `생성일시: ${new Date(result.processedAt).toLocaleString('ko-KR')}`,
    '',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  // 열 너비 설정
  ws['!cols'] = [
    { wch: 14 }, { wch: 8 }, { wch: 16 }, { wch: 40 },
    { wch: 22 }, { wch: 22 }, { wch: 16 }, { wch: 40 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, `${result.month}월_정책프로모션`);

  // ── 브랜드별 상세 시트 ─────────────────────────────────
  for (const b of result.brands) {
    if (b.error || !b.newProducts.length) continue;
    const sheetData = [
      ['신규 제품 목록', `${b.brand} (${result.month}월 기준)`],
      ['모델명', '제품명'],
      ...b.newProducts.map((p) => [p.model, p.name]),
    ];
    const detailWs = XLSX.utils.aoa_to_sheet(sheetData);
    detailWs['!cols'] = [{ wch: 20 }, { wch: 40 }];
    const safeSheetName = `${b.brand}_신규`.slice(0, 31);
    XLSX.utils.book_append_sheet(wb, detailWs, safeSheetName);
  }

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return Buffer.from(buf);
}
