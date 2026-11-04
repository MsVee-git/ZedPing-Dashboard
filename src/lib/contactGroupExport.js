import { csv } from './lifetimeReportExport.js';

export async function prepareContactGroupExport(request, group, format) {
  if (!group?.id || !['csv', 'txt'].includes(format)) throw new Error('Choose a group and export format.');
  // Always fetch the full authorized group, independent of list search/selection.
  const result = await request(`/${encodeURIComponent(group.id)}/members`);
  if (!Array.isArray(result?.members)) throw new Error('Could not load contacts for export.');
  const contacts = result.members.map(member => member.contact).filter(Boolean);
  if (!contacts.length) throw new Error('This group has no contacts to export.');
  const name = String(result.group?.name || group.name || 'Contact group');
  const basename = name.normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 100) || 'Contact_group';
  const numbers = [...new Set(contacts.map(contact => String(contact.phone_number || '').trim()).filter(Boolean))];
  if (format === 'txt' && !numbers.length) throw new Error('This group has no phone numbers to export.');
  return {
    filename: `${basename}_contacts.${format}`,
    type: format === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8',
    content: format === 'csv'
      ? csv([['Name', 'Phone', 'Tag', 'Group'], ...contacts.map(contact => [contact.name || '', contact.phone_number || '', contact.tag || '', name])])
      : numbers.join('\r\n') + '\r\n',
    count: format === 'csv' ? contacts.length : numbers.length
  };
}

export function downloadContactGroupExport(file) {
  const url = URL.createObjectURL(new Blob([file.content], { type: file.type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = file.filename;
  document.body.appendChild(link);
  try { link.click(); } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
