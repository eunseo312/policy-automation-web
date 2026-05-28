import * as XLSX from 'xlsx';

export interface ProductChange {
  model: string;
  name: string;
}

export interface BrandResult {
  brand: string;
  channel: 'DCP' | 'BM2';
  newProducts: ProductChange[];
  feeUp: number;
  feeDown: number;
  타사보상Cur: number;
  타사보상Prev: number;
  pkgCur: number;
  pkgPrev: number;
  promoCur: string[];
  halfpriceCur: number[];
  halfpricePrev: number[];
  error?: string;
}

export interface AnalysisResult {
  month: number;
  prevMonth: number;
  brands: BrandResult[];
  totalNewProducts: number;
  totalFeeChanges: number;
  processedAt: string;
}

type Row = Record<string, unknown>;

function sheetToRows(wb: XLSX.WorkBook, sheetName: string): Row[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`시트 없음: "${sheetName}"`);
  return XLSX.utils.sheet_to_json<Row>(ws, { defval: '' });
}

function numericUniq(data: Row[], col: string): number[] {
  const vals = data
    .map((r) => Number(r[col]))
    .filter((v) => !isNaN(v) && v > 0);
  return [...new Set(vals)].sort((a, b) => a - b);
}

function detectNewProducts(
  cur: Row[],
  prev: Row[],
  modelCol: string,
  nameCol: string
): ProductChange[] {
  if (!cur.length || !cur[0][modelCol]) return [];
  const prevModels = new Set(
    prev.map((r) => String(r[modelCol] ?? '')).filter(Boolean)
  );
  const seen = new Set<string>();
  const result: ProductChange[] = [];
  for (const r of cur) {
    const m = String(r[modelCol] ?? '').trim();
    if (!m || prevModels.has(m) || seen.has(m)) continue;
    seen.add(m);
    result.push({ model: m, name: String(r[nameCol] ?? '') });
  }
  return result;
}

function detectFeeChanges(
  cur: Row[],
  prev: Row[],
  keyColumns: string[],
  feeCol = '월요금'
): { up: number; down: number } {
  const validKey = keyColumns.filter(
    (k) => cur[0] && k in cur[0] && prev[0] && k in prev[0]
  );
  if (!validKey.length) return { up: 0, down: 0 };

  const makeKey = (r: Row) => validKey.map((k) => String(r[k] ?? '')).join('|');
  const prevMap = new Map<string, number>();
  for (const r of prev) {
    const k = makeKey(r);
    const fee = parseFloat(String(r[feeCol] ?? ''));
    if (!isNaN(fee)) prevMap.set(k, fee);
  }

  let up = 0, down = 0;
  const seen = new Set<string>();
  for (const r of cur) {
    const k = makeKey(r);
    if (seen.has(k)) continue;
    seen.add(k);
    const curFee = parseFloat(String(r[feeCol] ?? ''));
    const prevFee = prevMap.get(k);
    if (isNaN(curFee) || prevFee === undefined) continue;
    if (curFee > prevFee) up++;
    else if (curFee < prevFee) down++;
  }
  return { up, down };
}

function countPolicy(data: Row[], col: string, value: string): number {
  if (!data.length || !(col in data[0])) return 0;
  return data.filter((r) => String(r[col] ?? '').includes(value)).length;
}

function getPromotions(data: Row[], col: string): string[] {
  if (!data.length || !(col in data[0])) return [];
  return [
    ...new Set(
      data.map((r) => String(r[col] ?? '').trim()).filter(Boolean)
    ),
  ];
}

function getRegulCol(data: Row[]): string {
  if (!data.length) return '';
  if ('규정 구분' in data[0]) return '규정 구분';
  if ('규정' in data[0]) return '규정';
  return '';
}

// ── DCP 브랜드 분석 ───────────────────────────────────────
function analyzeDCP(
  wb: XLSX.WorkBook,
  brand: string,
  curSheet: string,
  prevSheet: string
): BrandResult {
  try {
    const cur = sheetToRows(wb, curSheet);
    const prev = sheetToRows(wb, prevSheet);

    const isSK = brand === 'SK인텔릭스';
    const modelCol = isSK ? '렌트리 제품명' : '렌트리 모델명';
    const nameCol = '렌트리 제품명';
    const keyCol = isSK
      ? ['렌트리 제품명', '관리방식', '의무사용기간', '계약기간', getRegulCol(cur)].filter(Boolean)
      : ['렌트리 모델명', '관리방식', '의무사용기간', '계약기간'];

    const newProducts = detectNewProducts(cur, prev, modelCol, nameCol);
    const { up, down } = detectFeeChanges(cur, prev, keyCol);

    const regulCol = getRegulCol(cur);
    const 타사보상Cur = countPolicy(cur, regulCol, '타사보상');
    const 타사보상Prev = countPolicy(prev, regulCol, '타사보상');

    const pkgCur = countPolicy(cur, '패키지 구분', '패키지');
    const pkgPrev = countPolicy(prev, '패키지 구분', '패키지');

    const promoCur = getPromotions(cur, '프로모션');
    const halfpriceCur = numericUniq(cur, '반값기간');
    const halfpricePrev = numericUniq(prev, '반값기간');

    return {
      brand,
      channel: 'DCP',
      newProducts,
      feeUp: up,
      feeDown: down,
      타사보상Cur,
      타사보상Prev,
      pkgCur,
      pkgPrev,
      promoCur,
      halfpriceCur,
      halfpricePrev,
    };
  } catch (e) {
    return {
      brand, channel: 'DCP',
      newProducts: [], feeUp: 0, feeDown: 0,
      타사보상Cur: 0, 타사보상Prev: 0, pkgCur: 0, pkgPrev: 0,
      promoCur: [], halfpriceCur: [], halfpricePrev: [],
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

// ── BM2 브랜드 분석 (단일 시트, 접수처 기준 분리) ────────────────
const BM2_BRAND_MAP: Record<string, string> = {
  'LG헬로비전': '헬로렌탈',
  '헬로렌탈': '헬로렌탈',
  '현대유버스': '현대유버스',
  '이니렌탈': '이니렌탈',
  '스마트렌탈': '스마트렌탈',
  'BS렌탈': 'BS렌탈',
};

function analyzeBM2(
  wb: XLSX.WorkBook,
  curSheet: string,
  prevSheet: string
): BrandResult[] {
  let curAll: Row[] = [];
  let prevAll: Row[] = [];

  try {
    curAll = sheetToRows(wb, curSheet);
  } catch {
    // BM2 시트 없으면 모두 에러로 반환
    return Object.values(BM2_BRAND_MAP)
      .filter((v, i, a) => a.indexOf(v) === i)
      .map((brand) => ({
        brand, channel: 'BM2' as const,
        newProducts: [], feeUp: 0, feeDown: 0,
        타사보상Cur: 0, 타사보상Prev: 0, pkgCur: 0, pkgPrev: 0,
        promoCur: [], halfpriceCur: [], halfpricePrev: [],
        error: `시트 없음: "${curSheet}"`,
      }));
  }
  try {
    prevAll = sheetToRows(wb, prevSheet);
  } catch {
    /* prev 없으면 빈 배열로 진행 */
  }

  const brands = [...new Set(Object.values(BM2_BRAND_MAP))];
  return brands.map((brandName): BrandResult => {
    const cur = curAll.filter((r) => {
      const v = String(r['접수처'] ?? '').trim();
      return BM2_BRAND_MAP[v] === brandName;
    });
    const prev = prevAll.filter((r) => {
      const v = String(r['접수처'] ?? '').trim();
      return BM2_BRAND_MAP[v] === brandName;
    });

    const newProducts = detectNewProducts(cur, prev, '모델명', '제품명');
    const { up, down } = detectFeeChanges(
      cur, prev, ['모델명', '관리방식', '의무사용기간']
    );

    const promoCurSales = getPromotions(cur, '영업 정책');
    const promoCurPromo = getPromotions(cur, '프로모션 정책');
    const promoCur = [...new Set([...promoCurSales, ...promoCurPromo])].filter(Boolean);

    return {
      brand: brandName, channel: 'BM2',
      newProducts, feeUp: up, feeDown: down,
      타사보상Cur: 0, 타사보상Prev: 0,
      pkgCur: 0, pkgPrev: 0,
      promoCur, halfpriceCur: [], halfpricePrev: [],
    };
  });
}

// ── 메인 분석 엔트리포인트 ────────────────────────────────
export function analyzeWorkbook(
  buffer: Buffer,
  month: number
): AnalysisResult {
  const prevMonth = month > 1 ? month - 1 : 12;
  const wb = XLSX.read(buffer, { type: 'buffer' });

  const DCP_BRANDS = [
    { brand: '코웨이',     curSheet: `코웨이_${month}월`,    prevSheet: `코웨이_${prevMonth}월` },
    { brand: '쿠쿠',       curSheet: `쿠쿠_${month}월`,      prevSheet: `쿠쿠_${prevMonth}월` },
    { brand: 'SK인텔릭스', curSheet: `SK_${month}월`,         prevSheet: `SK_${prevMonth}월` },
    { brand: '청호',       curSheet: `청호_${month}월`,       prevSheet: `청호_${prevMonth}월` },
  ];

  const dcpResults = DCP_BRANDS.map(({ brand, curSheet, prevSheet }) =>
    analyzeDCP(wb, brand, curSheet, prevSheet)
  );

  const bm2Results = analyzeBM2(
    wb,
    `BM2_${month}월`,
    `BM2_${prevMonth}월`
  );

  const brands = [...dcpResults, ...bm2Results];
  const totalNewProducts = brands.reduce((s, b) => s + b.newProducts.length, 0);
  const totalFeeChanges = brands.reduce((s, b) => s + b.feeUp + b.feeDown, 0);

  return {
    month,
    prevMonth,
    brands,
    totalNewProducts,
    totalFeeChanges,
    processedAt: new Date().toISOString(),
  };
}
