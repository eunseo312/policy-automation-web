import type { BrandResult } from '@/lib/analyze';

const CHANNEL_COLOR: Record<string, string> = {
  DCP: 'bg-blue-100 text-blue-800',
  BM2: 'bg-green-100 text-green-800',
};

interface Props {
  brand: BrandResult;
}

export default function BrandCard({ brand }: Props) {
  if (brand.error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-red-700">{brand.brand}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_COLOR[brand.channel]}`}>
            {brand.channel}
          </span>
        </div>
        <p className="text-sm text-red-600">{brand.error}</p>
      </div>
    );
  }

  const hasFeeChange = brand.feeUp > 0 || brand.feeDown > 0;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-gray-800 text-base">{brand.brand}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_COLOR[brand.channel]}`}>
            {brand.channel}
          </span>
        </div>
        {brand.newProducts.length > 0 && (
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-medium">
            신규 {brand.newProducts.length}건
          </span>
        )}
      </div>

      {/* 항목들 */}
      <dl className="space-y-1.5 text-sm">
        {/* 신규 제품 */}
        <Row label="신규 제품">
          {brand.newProducts.length === 0
            ? <span className="text-gray-400">없음</span>
            : <ul className="space-y-0.5">
                {brand.newProducts.slice(0, 3).map((p, i) => (
                  <li key={i} className="text-gray-700">
                    {p.name} <span className="text-gray-400">({p.model})</span>
                  </li>
                ))}
                {brand.newProducts.length > 3 && (
                  <li className="text-gray-400 text-xs">+{brand.newProducts.length - 3}개 더...</li>
                )}
              </ul>
          }
        </Row>

        {/* 월요금 변동 */}
        <Row label="월요금 변동">
          {!hasFeeChange
            ? <span className="text-gray-400">변동 없음</span>
            : <span>
                {brand.feeUp > 0 && <span className="text-red-600 mr-2">인상 {brand.feeUp}건</span>}
                {brand.feeDown > 0 && <span className="text-blue-600">인하 {brand.feeDown}건</span>}
              </span>
          }
        </Row>

        {/* DCP 전용 */}
        {brand.channel === 'DCP' && (
          <>
            <Row label="타사보상">
              <span className={brand.타사보상Cur !== brand.타사보상Prev ? 'font-medium text-orange-600' : 'text-gray-600'}>
                {brand.타사보상Cur}건
                {brand.타사보상Cur !== brand.타사보상Prev && (
                  <span className="text-gray-400 font-normal ml-1">(전월 {brand.타사보상Prev}건)</span>
                )}
              </span>
            </Row>
            <Row label="패키지">
              <span className={brand.pkgCur !== brand.pkgPrev ? 'font-medium text-orange-600' : 'text-gray-600'}>
                {brand.pkgCur}건
                {brand.pkgCur !== brand.pkgPrev && (
                  <span className="text-gray-400 font-normal ml-1">(전월 {brand.pkgPrev}건)</span>
                )}
              </span>
            </Row>
            {brand.halfpriceCur.length > 0 && (
              <Row label="반값기간">
                <span className="text-gray-700">
                  {brand.halfpriceCur.join('/')}개월
                  {JSON.stringify(brand.halfpriceCur) !== JSON.stringify(brand.halfpricePrev) &&
                    brand.halfpricePrev.length > 0 && (
                    <span className="text-gray-400 ml-1">(전월: {brand.halfpricePrev.join('/')}개월)</span>
                  )}
                </span>
              </Row>
            )}
          </>
        )}

        {/* BM2 프로모션 */}
        {brand.channel === 'BM2' && brand.promoCur.length > 0 && (
          <Row label="프로모션">
            <span className="text-gray-700 text-xs leading-relaxed">
              {brand.promoCur.slice(0, 3).join(' / ')}
              {brand.promoCur.length > 3 && ` 외 ${brand.promoCur.length - 3}건`}
            </span>
          </Row>
        )}
      </dl>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="text-gray-400 w-20 flex-shrink-0 pt-0.5">{label}</dt>
      <dd className="flex-1">{children}</dd>
    </div>
  );
}
