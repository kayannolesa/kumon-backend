export function renderTemplate(text, ctx) {
  return text
    .replaceAll('{studentFirst}', ctx.studentFirst ?? '')
    .replaceAll('{studentLast}', ctx.studentLast ?? '')
    .replaceAll('{time}', ctx.time ?? '');
}
