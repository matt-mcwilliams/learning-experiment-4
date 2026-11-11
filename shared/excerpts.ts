// Reflow only physical line wraps. Do not paraphrase or repair mathematical claims.
export function reflowPdfText(text: string) {
  return text
    .normalize('NFC')
    .replace(
      /[ﬀﬁﬂﬃﬄ]/gu,
      (character) => ({ ﬀ: 'ff', ﬁ: 'fi', ﬂ: 'fl', ﬃ: 'ffi', ﬄ: 'ffl' })[character]!,
    )
    .replace(/(\p{L})-\s*\n\s*(\p{L})/gu, '$1$2')
    .replace(/\s+/gu, ' ')
    .trim();
}
