// Original, redistributable PDF fixture with a real selectable text layer.
export function annotatedPdf() {
  const lines = [
    'Sampling, uncertainty, and independent observations',
    'A sample mean combines several noisy observations into one estimate.',
    'The point is to understand what repeated sampling can establish,',
    'rather than to mistake a smooth formula for empirical evidence.',
    '',
    'For independent observations, variances add. The sample mean has',
    'variance equal to the observation variance divided by sample size.',
    'This conclusion depends on the covariance terms being zero.',
    'Physical line wrapping must not turn a coherent explanation',
    'into a sequence of disconnected fragments for the reader.',
    '',
    'An experiment should begin with a prediction. Repeat indepen-',
    'dent trials, preserve random seeds, and report unexpected results.',
    'A fixed seed establishes reproducibility, not independent evidence.',
  ];
  const escape = (s: string) =>
    s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content =
    'BT /F1 12 Tf 50 740 Td 19 TL\n' +
    lines.map((line, i) => `${i ? 'T* ' : ''}(${escape(line)}) Tj`).join('\n') +
    '\nET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
  ];
  return assemblePdf(objects);
}
function assemblePdf(objects: (string | Buffer)[]) {
  const chunks = [Buffer.from('%PDF-1.4\n')];
  const offsets: number[] = [];
  let length = chunks[0].length;
  for (let i = 0; i < objects.length; i++) {
    offsets.push(length);
    const object = Buffer.concat([
      Buffer.from(`${i + 1} 0 obj\n`),
      Buffer.from(objects[i]),
      Buffer.from('\nendobj\n'),
    ]);
    chunks.push(object);
    length += object.length;
  }
  const xref = length;
  chunks.push(
    Buffer.from(
      `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
        offsets.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
        `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`,
    ),
  );
  return Buffer.concat(chunks);
}

// Original scan-like artwork: a border and six horizontal bars, encoded as a
// JBIG2 MMR generic region. An invisible OCR line reproduces the reported failure:
// text selection works even when the separate image decoder is missing.
// The Group 4 bytes encode a 192x160 bilevel image, not third-party paper content.
export function scannedPdf(pages = 8) {
  const fax = Buffer.from(
    'JqGSG////yHkU//MBkBpf////////////IJtK///////8f///////////yCbSv///////H///////////8gm0r///////x////////////IJtK///////8f///////////yCbSv///////H///////////8gm0r///////x////////////////////+P/x///+ACACA',
    'base64',
  );
  const segment = (number: number, type: number, data: Buffer) => {
    const header = Buffer.alloc(11);
    header.writeUInt32BE(number);
    header[4] = type;
    header[6] = 1;
    header.writeUInt32BE(data.length, 7);
    return Buffer.concat([header, data]);
  };
  const info = Buffer.alloc(19);
  info.writeUInt32BE(192);
  info.writeUInt32BE(160, 4);
  const region = Buffer.alloc(18);
  region.writeUInt32BE(192);
  region.writeUInt32BE(160, 4);
  region[17] = 1;
  const image = Buffer.concat([segment(1, 48, info), segment(2, 38, Buffer.concat([region, fax]))]);
  const stream = (dictionary: string, data: Buffer) =>
    Buffer.concat([
      Buffer.from(`<< ${dictionary} /Length ${data.length} >>\nstream\n`),
      data,
      Buffer.from('\nendstream'),
    ]);
  return assemblePdf([
    '<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${i + 6} 0 R`).join(' ')}] /Count ${pages} >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    stream(
      '/Type /XObject /Subtype /Image /Width 192 /Height 160 /ColorSpace /DeviceGray /BitsPerComponent 1 /Filter /JBIG2Decode',
      image,
    ),
    stream(
      '',
      Buffer.from(
        'q 400 0 0 330 100 250 cm /Scan Do Q\nBT /F1 12 Tf 3 Tr 50 590 Td (Selectable scan text. Inspect the observations independently.) Tj ET',
      ),
    ),
    ...Array.from(
      { length: pages },
      (_, i) =>
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${i % 2 ? '792 612' : '612 792'}] /Resources << /Font << /F1 3 0 R >> /XObject << /Scan 4 0 R >> >> /Contents 5 0 R >>`,
    ),
  ]);
}
