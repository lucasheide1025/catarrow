const ALLOWED_STATUS = new Set(['draft', 'published']);

function text(value, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}
function slugify(value) {
  return text(value, 120).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-');
}
function validSlug(value) {
  return /^[a-z0-9\u4e00-\u9fff]+(?:-[a-z0-9\u4e00-\u9fff]+)*$/.test(String(value || ''));
}
function list(value, maxItems = 50, maxLen = 300) {
  return (Array.isArray(value) ? value : []).map(v => text(v, maxLen)).filter(Boolean).slice(0, maxItems);
}
function sanitizeParticipant(row = {}) {
  return {
    publicDisplayName: text(row.publicDisplayName, 80),
    bowType: text(row.bowType, 80),
    category: text(row.category, 100),
    score: text(row.score, 80),
    rank: text(row.rank, 80),
    award: text(row.award, 120),
    resultNote: text(row.resultNote, 300),
  };
}
function sanitizePublicEvent(source = {}) {
  const slug = slugify(source.slug || source.title);
  const status = ALLOWED_STATUS.has(source.status) ? source.status : 'draft';
  return {
    slug,
    title: text(source.title, 160),
    eventDate: text(source.eventDate, 20),
    endDate: text(source.endDate, 20),
    location: text(source.location, 160),
    organizer: text(source.organizer, 160),
    eventType: text(source.eventType, 100),
    summary: text(source.summary, 500),
    story: text(source.story, 12000),
    coverImageUrl: text(source.coverImageUrl, 1200),
    galleryImageUrls: list(source.galleryImageUrls, 30, 1200),
    tags: list(source.tags, 20, 80),
    featured: source.featured === true,
    status,
    publishedAt: text(source.publishedAt, 40),
    updatedAt: text(source.updatedAt, 40),
    participants: (Array.isArray(source.participants) ? source.participants : []).map(sanitizeParticipant).filter(row => row.publicDisplayName || row.rank || row.award || row.resultNote),
  };
}
function validatePublicEvent(event) {
  const errors = [];
  if (!event.title) errors.push('title is required');
  if (!event.eventDate) errors.push('eventDate is required');
  if (!event.slug || !validSlug(event.slug)) errors.push('slug is invalid');
  return errors;
}
function publishedEvents(source) {
  const seen = new Set();
  return (Array.isArray(source) ? source : []).map(sanitizePublicEvent)
    .filter(event => event.status === 'published')
    .filter(event => validatePublicEvent(event).length === 0)
    .filter(event => { if (seen.has(event.slug)) return false; seen.add(event.slug); return true; })
    .sort((a, b) => String(b.eventDate).localeCompare(String(a.eventDate)) || a.title.localeCompare(b.title, 'zh-Hant'));
}
function buildSnapshot(source, generatedAt = new Date().toISOString()) {
  const rawEvents = Array.isArray(source?.events) ? source.events : source;
  return { generatedAt, events: publishedEvents(rawEvents) };
}
module.exports = { slugify, validSlug, sanitizeParticipant, sanitizePublicEvent, validatePublicEvent, publishedEvents, buildSnapshot };
