import type { NextApiRequest, NextApiResponse } from 'next';
import formidable from 'formidable';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { analyzeWorkbook } from '@/lib/analyze';
import { buildExcel } from '@/lib/excel-writer';

export const config = {
  api: { bodyParser: false },
};

const TMP_DIR = path.join(process.cwd(), 'tmp');

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const form = formidable({ maxFileSize: 50 * 1024 * 1024 });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      return res.status(400).json({ error: `파일 파싱 오류: ${err.message}` });
    }

    const uploadedFile = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!uploadedFile) {
      return res.status(400).json({ error: '파일이 없습니다.' });
    }

    const monthRaw = Array.isArray(fields.month) ? fields.month[0] : fields.month;
    const month = monthRaw ? parseInt(monthRaw, 10) : new Date().getMonth() + 1;

    if (isNaN(month) || month < 1 || month > 12) {
      return res.status(400).json({ error: '유효하지 않은 월입니다.' });
    }

    try {
      const buffer = fs.readFileSync(uploadedFile.filepath);
      const result = analyzeWorkbook(buffer, month);
      const excelBuffer = buildExcel(result);

      const id = uuidv4();
      const outPath = path.join(TMP_DIR, `${id}.xlsx`);
      fs.writeFileSync(outPath, excelBuffer);

      // 임시 업로드 파일 삭제
      fs.unlinkSync(uploadedFile.filepath);

      // 30분 후 출력 파일 자동 삭제
      setTimeout(() => {
        if (fs.existsSync(outPath)) fs.unlinkSync(outPath);
      }, 30 * 60 * 1000);

      return res.status(200).json({ result, downloadId: id });
    } catch (e) {
      return res.status(500).json({
        error: e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.',
      });
    }
  });
}
