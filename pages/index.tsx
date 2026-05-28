import Head from 'next/head';
import { useState } from 'react';
import UploadZone from '@/components/UploadZone';
import BrandCard from '@/components/BrandCard';
import type { AnalysisResult } from '@/lib/analyze';

type Status = 'idle' | 'uploading' | 'done' | 'error';

export default function Home() {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [status, setStatus] = useState<Status>('idle');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [downloadId, setDownloadId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleFile = async (file: File) => {
    setStatus('uploading');
    setResult(null);
    setErrorMsg('');

    const formData = new FormData();
    formData.append('file', file);
    formData.append('month', String(month));

    try {
      const res = await fetch('/api/process', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? '처리 오류');
      setResult(json.result as AnalysisResult);
      setDownloadId(json.downloadId as string);
      setStatus('done');
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : '알 수 없는 오류');
      setStatus('error');
    }
  };

  const dcpBrands = result?.brands.filter((b) => b.channel === 'DCP') ?? [];
  const bm2Brands = result?.brands.filter((b) => b.channel === 'BM2') ?? [];

  return (
    <>
      <Head>
        <title>정책 프로모션 변동 추이 자동화</title>
        <meta name="description" content="DCP·BM2 채널 정책 프로모션 변동 분석 도구" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="min-h-screen bg-gray-50">
        {/* 헤더 */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center gap-3">
            <span className="text-2xl">📊</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">
                정책 프로모션 변동 추이 자동화
              </h1>
              <p className="text-xs text-gray-500">DCP 4개사 · BM2 5개사 월별 비교 분석</p>
            </div>
          </div>
        </header>

        <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          {/* 업로드 섹션 */}
          <section className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 space-y-5">
            <h2 className="font-semibold text-gray-800">분석 파일 업로드</h2>

            {/* 월 선택 */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600 font-medium">분석 기준월</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                disabled={status === 'uploading'}
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>{m}월</option>
                ))}
              </select>
              <span className="text-xs text-gray-400">(전월과 자동 비교)</span>
            </div>

            <UploadZone onFile={handleFile} disabled={status === 'uploading'} />

            {/* 시트명 안내 */}
            <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 leading-relaxed">
              <span className="font-medium text-gray-500">필요 시트명 예시 ({month}월 선택 시):&nbsp;</span>
              코웨이_{month}월 / 코웨이_{month > 1 ? month - 1 : 12}월,&nbsp;
              쿠쿠_{month}월, SK_{month}월, 청호_{month}월,&nbsp;
              BM2_{month}월
            </div>
          </section>

          {/* 로딩 */}
          {status === 'uploading' && (
            <div className="flex items-center justify-center py-16 gap-3 text-blue-600">
              <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <span className="font-medium">분석 중...</span>
            </div>
          )}

          {/* 오류 */}
          {status === 'error' && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-700">
              <p className="font-medium mb-1">오류 발생</p>
              <p className="text-sm">{errorMsg}</p>
            </div>
          )}

          {/* 결과 */}
          {status === 'done' && result && (
            <section className="space-y-6">
              {/* 요약 바 */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
                <div className="flex flex-wrap gap-4 items-center justify-between">
                  <div>
                    <span className="text-sm text-gray-500">분석 기준</span>
                    <p className="font-bold text-gray-900">
                      {result.month}월 대비 {result.prevMonth}월 변동
                    </p>
                  </div>
                  <div className="flex gap-6">
                    <Stat label="총 신규 제품" value={`${result.totalNewProducts}건`} color="emerald" />
                    <Stat label="총 요금 변동" value={`${result.totalFeeChanges}건`} color="blue" />
                    <Stat label="분석 브랜드" value={`${result.brands.length}개사`} color="gray" />
                  </div>
                  {downloadId && (
                    <a
                      href={`/api/download?id=${downloadId}&month=${result.month}`}
                      className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
                    >
                      <span>Excel 다운로드</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    </a>
                  )}
                </div>
              </div>

              {/* DCP 브랜드 */}
              {dcpBrands.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-blue-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full inline-block" />
                    DCP 채널
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {dcpBrands.map((b) => <BrandCard key={b.brand} brand={b} />)}
                  </div>
                </div>
              )}

              {/* BM2 브랜드 */}
              {bm2Brands.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-green-700 uppercase tracking-wide mb-3 flex items-center gap-2">
                    <span className="w-2 h-2 bg-green-500 rounded-full inline-block" />
                    BM2 채널
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {bm2Brands.map((b) => <BrandCard key={b.brand} brand={b} />)}
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>
    </>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: 'emerald' | 'blue' | 'gray';
}) {
  const cls =
    color === 'emerald' ? 'text-emerald-600' :
    color === 'blue'    ? 'text-blue-600'    :
    'text-gray-600';
  return (
    <div className="text-center">
      <p className={`text-xl font-bold ${cls}`}>{value}</p>
      <p className="text-xs text-gray-400">{label}</p>
    </div>
  );
}
