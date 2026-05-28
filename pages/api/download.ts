import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

const TMP_DIR = path.join(process.cwd(), 'tmp');

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, month } = req.query;

  if (!id || typeof id !== 'string' || !/^[0-9a-f-]{36}$/.test(id)) {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const filePath = path.join(TMP_DIR, `${id}.xlsx`);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: '파일을 찾을 수 없습니다. 다시 분석해주세요.' });
  }

  const monthLabel = month ?? new Date().getMonth() + 1;
  const filename = encodeURIComponent(`${monthLabel}월_정책_프로모션_정리_완성.xlsx`);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${filename}`);

  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
}
