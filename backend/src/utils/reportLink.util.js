const HttpError = require('./httpError');

function providerFor(hostname) {
  const host = hostname.toLowerCase();
  if (host.includes('sharepoint.com') || host.includes('onedrive.live.com') || host === '1drv.ms') return 'Microsoft 365';
  if (host === 'docs.google.com' || host.endsWith('.docs.google.com')) return 'Google Workspace';
  if (host === 'dropbox.com' || host.endsWith('.dropbox.com')) return 'Dropbox';
  return hostname;
}

function inferredTitle(url) {
  const finalSegment = url.pathname.split('/').filter(Boolean).at(-1);
  if (!finalSegment) return `Online report · ${url.hostname}`;
  try { return decodeURIComponent(finalSegment).slice(0, 255); } catch { return finalSegment.slice(0, 255); }
}

function validateReportLink(rawUrl, rawTitle) {
  if (typeof rawUrl !== 'string' || rawUrl.trim().length < 1 || rawUrl.trim().length > 2048) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'url must contain between 1 and 2048 characters');
  }
  let url;
  try { url = new URL(rawUrl.trim()); } catch { throw new HttpError(400, 'INVALID_REPORT_URL', 'Report URL must be a valid absolute HTTPS URL'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) {
    throw new HttpError(400, 'INVALID_REPORT_URL', 'Report URL must be a valid absolute HTTPS URL');
  }
  const suppliedTitle = rawTitle === undefined || rawTitle === null ? '' : String(rawTitle).trim();
  if (suppliedTitle.length > 255) throw new HttpError(400, 'VALIDATION_ERROR', 'title must not exceed 255 characters');
  return {
    url: url.toString(),
    title: suppliedTitle || inferredTitle(url),
    provider: providerFor(url.hostname),
    mediaType: 'text/uri-list',
  };
}

module.exports = { validateReportLink };
