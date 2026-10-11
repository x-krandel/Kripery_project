const LOOKUP_TIMEOUT_MS = 8000;

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function wikipediaSearch(query, language) {
  if (!query) return null;
  const url = new URL(`https://${language}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "1",
    format: "json",
    origin: "*",
  });
  const result = await fetchJson(url);
  const pageTitle = result?.query?.search?.[0]?.title;
  if (!pageTitle) return null;

  const summaryUrl = `https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(pageTitle)}`;
  const summary = await fetchJson(summaryUrl);
  if (!summary?.extract) return null;
  return {
    title: summary.title || pageTitle,
    extract: summary.extract,
    url: summary.content_urls?.desktop?.page || `https://${language}.wikipedia.org/wiki/${encodeURIComponent(pageTitle.replaceAll(" ", "_"))}`,
    language,
  };
}

async function wikipediaLookup(query) {
  if (!query) return null;
  return (await wikipediaSearch(query, "pl")) || wikipediaSearch(query, "en");
}

async function metLookup(query) {
  if (!query) return [];
  const base = "https://collectionapi.metmuseum.org/public/collection/v1";
  const search = await fetchJson(`${base}/search?hasImages=true&q=${encodeURIComponent(query)}`);
  const objectIds = search?.objectIDs?.slice(0, 2) || [];
  const records = await Promise.all(objectIds.map((id) => fetchJson(`${base}/objects/${id}`)));
  return records.filter((record) => record?.title).map((record) => ({
    title: record.title,
    artist: record.artistDisplayName || "",
    date: record.objectDate || "",
    medium: record.medium || "",
    image: record.primaryImageSmall || "",
    url: record.objectURL || "",
    source: "The Met",
  }));
}

async function articLookup(query) {
  if (!query) return [];
  const params = new URLSearchParams({
    q: query,
    limit: "2",
    fields: "id,title,artist_display,date_display,image_id",
  });
  const response = await fetchJson(`https://api.artic.edu/api/v1/artworks/search?${params}`);
  return (response?.data || []).map((record) => ({
    title: record.title,
    artist: record.artist_display?.split("\n")[0] || "",
    date: record.date_display || "",
    medium: "",
    image: record.image_id ? `https://www.artic.edu/iiif/2/${record.image_id}/full/200,/0/default.jpg` : "",
    url: `https://www.artic.edu/artworks/${record.id}`,
    source: "Art Institute of Chicago",
  }));
}

async function lookupArtwork({ title, author }) {
  const normalizedTitle = title?.trim() || "";
  const normalizedAuthor = author?.trim() || "";
  const [work, artist, metRecords, articRecords] = await Promise.all([
    wikipediaLookup(normalizedTitle),
    wikipediaLookup(normalizedAuthor),
    metLookup(normalizedTitle),
    articLookup(normalizedTitle),
  ]);
  const museumRecords = [...metRecords, ...articRecords]
    .filter((record) => record.url)
    .filter((record, index, records) => records.findIndex((candidate) => candidate.url === record.url) === index);
  return { work, artist, museumRecords };
}
