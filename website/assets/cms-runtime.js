(() => {
  const PROJECT_ID = "catgroup-8d0bb";
  const params = new URLSearchParams(location.search);
  const parts = location.pathname.split("/").filter(Boolean);
  const isHome = location.pathname === "/" || location.pathname.endsWith("/index.html") || location.pathname.endsWith("/index-redesign.html");
  const inferred = isHome ? "home" : (parts.at(-1)?.includes(".") ? parts.at(-2) : parts.at(-1));
  const pageId = params.get("pageId") || inferred || "home";
  const previewMode = params.get("cmsPreview") === "1";
  const selector = "h1,h2,h3,h4,p,li,summary,a,button,small,strong";
  const textNodes = [...document.querySelectorAll(selector)].filter(element =>
    !element.closest("[data-cms-ignore],script,style,noscript") &&
    element.textContent.trim() &&
    ![...element.children].some(child => child.matches(selector))
  );
  const imageNodes = [...document.querySelectorAll("img")].filter(image => !image.closest("[data-cms-ignore]"));
  let legacyTextIndex = 0;
  let legacyImageIndex = 0;
  textNodes.forEach(element => {
    element.dataset.cmsKey = element.dataset.cms || `text-${++legacyTextIndex}`;
  });
  imageNodes.forEach(image => {
    image.dataset.cmsKey = image.dataset.cmsImage || `image-${++legacyImageIndex}`;
  });
  const defaults = {
    text: Object.fromEntries(textNodes.map(element => [element.dataset.cmsKey, element.textContent.trim()])),
    html: Object.fromEntries(textNodes.map(element => [element.dataset.cmsKey, element.innerHTML])),
    images: Object.fromEntries(imageNodes.map(image => [image.dataset.cmsKey, { src: image.getAttribute("src") || "", alt: image.alt || "" }])),
  };
  const manifest = () => ({
    type: "CAT_ARCHERY_CMS_MANIFEST", pageId,
    text: textNodes.map((element, index) => ({ key: element.dataset.cmsKey, label: `${element.tagName.toLowerCase()} ${index + 1}｜${element.textContent.trim().slice(0, 28)}`, value: defaults.text[element.dataset.cmsKey] })),
    images: imageNodes.map((image, index) => ({ key: image.dataset.cmsKey, label: `圖片 ${index + 1}｜${image.alt || "未填替代文字"}`, src: defaults.images[image.dataset.cmsKey].src, alt: defaults.images[image.dataset.cmsKey].alt })),
  });
  const apply = (content = {}, selected = "") => {
    textNodes.forEach(element => {
      const key = element.dataset.cmsKey;
      if (Object.prototype.hasOwnProperty.call(content.text || {}, key)) element.textContent = content.text[key];
      else element.innerHTML = defaults.html[key];
      element.style.outline = previewMode && selected === key ? "3px solid #f97316" : "";
      element.style.outlineOffset = previewMode && selected === key ? "4px" : "";
    });
    imageNodes.forEach(image => {
      const key = image.dataset.cmsKey;
      const value = content.images?.[key] || defaults.images[key];
      image.src = value.src || defaults.images[key].src;
      image.alt = value.alt ?? defaults.images[key].alt;
      image.style.outline = previewMode && selected === key ? "3px solid #f97316" : "";
      image.style.outlineOffset = previewMode && selected === key ? "4px" : "";
    });
  };
  window.addEventListener("message", event => {
    if (event.data?.pageId !== pageId) return;
    if (event.data.type === "CAT_ARCHERY_CMS_REQUEST") event.source?.postMessage(manifest(), "*");
    if (event.data.type === "CAT_ARCHERY_CMS_PREVIEW") apply(event.data.content, event.data.selected);
  });
  if (previewMode) {
    parent.postMessage(manifest(), "*");
    return;
  }
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/publicWebsiteContent/${encodeURIComponent(pageId)}`;
  fetch(url, { mode: "cors", credentials: "omit" })
    .then(response => response.ok ? response.json() : null)
    .then(document => {
      const raw = document?.fields?.publishedJson?.stringValue;
      if (raw) apply(JSON.parse(raw));
    })
    .catch(() => {});
})();
