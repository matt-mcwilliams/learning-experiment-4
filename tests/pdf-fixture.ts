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
  let value = '%PDF-1.4\n';
  const offsets: number[] = [];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(value));
    value += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(value);
  value +=
    `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n` +
    offsets.map((n) => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(value);
}
