const STORAGE_FAVORITES_KEY = 'arcadevault_favorites_v1';
const STORAGE_RECENT_KEY = 'arcadevault_recent_v1';
const STORAGE_CUSTOM_GAMES_KEY = 'arcadevault_custom_games_v1';

const state = {
  baseGames: [],
  customGames: [],
  favorites: [],
  recentIds: [],
  category: 'all',
  search: '',
  sort: 'featured',
  activeGameId: null,
  publicBase: './',
};

const els = {
  brandHomeLink: document.getElementById('brand-home-link'),
  navLinks: Array.from(document.querySelectorAll('.nav-link')),
  mobileCategorySelect: document.getElementById('mobile-category-select'),
  openAddModalBtn: document.getElementById('open-add-modal-btn'),

  libraryView: document.getElementById('library-view'),
  playerStage: document.getElementById('player-stage'),
  backToLibraryBtn: document.getElementById('back-to-library-btn'),
  stageGameTitle: document.getElementById('stage-game-title'),
  stageGameMeta: document.getElementById('stage-game-meta'),
  stageFavoriteBtn: document.getElementById('stage-favorite-btn'),
  stageReloadBtn: document.getElementById('stage-reload-btn'),
  stageJsonBtn: document.getElementById('stage-json-btn'),
  stageFullscreenBtn: document.getElementById('stage-fullscreen-btn'),
  stageIframeWrapper: document.getElementById('stage-iframe-wrapper'),
  stageIframeMount: document.getElementById('stage-iframe-mount'),
  stageJsonDrawer: document.getElementById('stage-json-drawer'),
  stageJsonCode: document.getElementById('stage-json-code'),
  copyEntryJsonBtn: document.getElementById('copy-entry-json-btn'),

  featuredThumb: document.getElementById('featured-thumb'),
  featuredFallbackTitle: document.getElementById('featured-fallback-title'),
  featuredMeta: document.getElementById('featured-meta'),
  featuredTitle: document.getElementById('featured-title'),
  featuredDesc: document.getElementById('featured-desc'),
  featuredPlayBtn: document.getElementById('featured-play-btn'),
  featuredSpotlight: document.getElementById('featured-spotlight'),

  randomGameBtn: document.getElementById('random-game-btn'),
  viewCatalogJsonBtn: document.getElementById('view-catalog-json-btn'),

  catalogHeading: document.getElementById('catalog-heading'),
  catalogCount: document.getElementById('catalog-count'),
  searchInput: document.getElementById('search-input'),
  sortSelect: document.getElementById('sort-select'),
  catalogStatus: document.getElementById('catalog-status'),
  gamesGrid: document.getElementById('games-grid'),

  exportJsonBtn: document.getElementById('export-json-btn'),
  resetCustomBtn: document.getElementById('reset-custom-btn'),

  addModal: document.getElementById('add-modal'),
  closeAddModalBtn: document.getElementById('close-add-modal-btn'),
  cancelAddModalBtn: document.getElementById('cancel-add-modal-btn'),
  addGameForm: document.getElementById('add-game-form'),
  addFormError: document.getElementById('add-form-error'),

  jsonModal: document.getElementById('json-modal'),
  closeJsonModalBtn: document.getElementById('close-json-modal-btn'),
  fullJsonCode: document.getElementById('full-json-code'),
  copyAllJsonBtn: document.getElementById('copy-all-json-btn'),
  downloadAllJsonBtn: document.getElementById('download-all-json-btn'),

  toastRegion: document.getElementById('toast-region'),
};

function readStorageArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStorageArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function getAllGames() {
  return [...state.baseGames, ...state.customGames];
}

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  els.toastRegion.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 2400);
}

function resolveAssetUrl(rawPath) {
  const path = String(rawPath || '').trim();
  if (!path) return '';
  if (path.startsWith('/src/')) {
    return `.${path}`;
  }
  if (path.startsWith('/games/')) {
    return `${state.publicBase}${path.slice(1)}`;
  }
  if (path.startsWith('./games/')) {
    return `${state.publicBase}${path.slice(2)}`;
  }
  return path;
}

/**
 * Safely parses an iframe HTML string from games.json and builds a clean <iframe> element.
 */
function buildSafeIframe(iframeMarkup, fallbackTitle) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(iframeMarkup || ''), 'text/html');
  const parsed = doc.querySelector('iframe');
  if (!parsed) {
    return null;
  }

  const rawSrc = (parsed.getAttribute('src') || '').trim();
  if (!rawSrc) {
    return null;
  }

  // Allow relative local paths (/games/..., ./games/...) or http/https URLs only
  const isRelative = (rawSrc.startsWith('/') && !rawSrc.startsWith('//')) || rawSrc.startsWith('./') || rawSrc.startsWith('../');
  let isSafeProtocol = isRelative;
  if (!isRelative) {
    try {
      const url = new URL(rawSrc, window.location.origin);
      isSafeProtocol = url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      isSafeProtocol = false;
    }
  }

  if (!isSafeProtocol) {
    return null;
  }

  const frame = document.createElement('iframe');
  frame.src = resolveAssetUrl(rawSrc);
  frame.title = parsed.getAttribute('title') || fallbackTitle || 'Embedded Game';
  frame.loading = 'eager';
  frame.referrerPolicy = 'no-referrer';
  frame.setAttribute('allowfullscreen', '');
  const allowAttr = parsed.getAttribute('allow');
  frame.setAttribute('allow', allowAttr || 'fullscreen; autoplay; gamepad');
  const sandboxAttr = parsed.getAttribute('sandbox');
  if (sandboxAttr !== null) {
    frame.setAttribute('sandbox', sandboxAttr);
  }
  const scrollingAttr = parsed.getAttribute('scrolling');
  if (scrollingAttr) {
    frame.setAttribute('scrolling', scrollingAttr);
  }
  return frame;
}

function normalizeIframeInput(rawInput, title) {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { error: 'Please paste an iframe HTML snippet or a game URL.' };
  }

  let candidateMarkup = trimmed;
  if (!trimmed.toLowerCase().includes('<iframe')) {
    try {
      const parsedUrl = new URL(trimmed, window.location.origin);
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return { error: 'Game URL must begin with https://, http://, or /.' };
      }
      const safeTitle = title.replace(/"/g, '&quot;');
      candidateMarkup = `<iframe src="${trimmed.replace(/"/g, '&quot;')}" title="${safeTitle}" allow="fullscreen" allowfullscreen loading="lazy"></iframe>`;
    } catch {
      return { error: 'Enter a valid URL or a complete <iframe> tag.' };
    }
  }

  const testFrame = buildSafeIframe(candidateMarkup, title);
  if (!testFrame) {
    return { error: 'Invalid iframe code. Ensure it includes a valid http(s) or relative src attribute.' };
  }

  const esc = (val) => String(val).replace(/"/g, '&quot;');
  const attrs = [
    `src="${esc(testFrame.getAttribute('src'))}"`,
    `title="${esc(testFrame.title)}"`,
    `allow="${esc(testFrame.getAttribute('allow') || 'fullscreen')}"`,
  ];
  if (testFrame.hasAttribute('sandbox')) {
    attrs.push(`sandbox="${esc(testFrame.getAttribute('sandbox'))}"`);
  }
  attrs.push('allowfullscreen', 'loading="lazy"');

  return {
    iframe: `<iframe ${attrs.join(' ')}></iframe>`,
  };
}

function getFilteredGames() {
  const term = state.search.trim().toLowerCase();
  let list = getAllGames().filter((game) => {
    if (state.category === 'favorites') {
      if (!state.favorites.includes(game.id)) return false;
    } else if (state.category !== 'all') {
      if (game.category !== state.category) return false;
    }

    if (term) {
      const haystack = `${game.title} ${game.category} ${game.controls || ''} ${game.description || ''}`.toLowerCase();
      if (!haystack.includes(term)) return false;
    }

    return true;
  });

  if (state.sort === 'title') {
    list = [...list].sort((a, b) => a.title.localeCompare(b.title));
  } else if (state.sort === 'recent') {
    list = [...list].sort((a, b) => {
      const idxA = state.recentIds.indexOf(a.id);
      const idxB = state.recentIds.indexOf(b.id);
      const rankA = idxA === -1 ? Number.MAX_SAFE_INTEGER : idxA;
      const rankB = idxB === -1 ? Number.MAX_SAFE_INTEGER : idxB;
      return rankA - rankB;
    });
  }

  return list;
}

function updateCategoryUI() {
  els.navLinks.forEach((btn) => {
    const isMatch = btn.dataset.category === state.category;
    btn.classList.toggle('is-active', isMatch);
    btn.setAttribute('aria-current', isMatch ? 'page' : 'false');
  });

  if (els.mobileCategorySelect.value !== state.category) {
    els.mobileCategorySelect.value = state.category;
  }

  const headingMap = {
    all: 'Game Library',
    Arcade: 'Arcade Games',
    Puzzle: 'Puzzle Games',
    favorites: 'Saved Favorites',
  };
  els.catalogHeading.textContent = headingMap[state.category] || 'Game Library';
}

function renderFeatured() {
  const games = getAllGames();
  const heroGrid = els.featuredSpotlight.parentElement;
  if (games.length === 0) {
    els.featuredSpotlight.hidden = true;
    if (heroGrid) heroGrid.classList.add('is-empty');
    els.randomGameBtn.disabled = true;
    return;
  }
  els.featuredSpotlight.hidden = false;
  if (heroGrid) heroGrid.classList.remove('is-empty');
  els.randomGameBtn.disabled = false;

  const featured = games[0];
  const thumbUrl = resolveAssetUrl(featured.thumbnail);
  if (!thumbUrl) {
    els.featuredThumb.removeAttribute('src');
    els.featuredThumb.parentElement.classList.add('is-broken');
  } else {
    els.featuredThumb.parentElement.classList.remove('is-broken');
    els.featuredThumb.src = thumbUrl;
  }
  els.featuredThumb.alt = `${featured.title} cover art`;
  els.featuredThumb.onerror = () => {
    els.featuredThumb.parentElement.classList.add('is-broken');
  };
  els.featuredFallbackTitle.textContent = featured.title;
  els.featuredMeta.textContent = `Featured · ${featured.category}`;
  els.featuredTitle.textContent = featured.title;
  els.featuredDesc.textContent = featured.description || '';
  els.featuredPlayBtn.onclick = () => launchGame(featured.id);
}

function renderCatalog() {
  updateCategoryUI();
  const totalGames = getAllGames().length;
  const filtered = getFilteredGames();
  const favCount = state.favorites.length;
  const gameWord = filtered.length === 1 ? 'game' : 'games';
  els.catalogCount.textContent = `${filtered.length} ${gameWord} · ${favCount} saved`;
  els.resetCustomBtn.hidden = state.customGames.length === 0;

  els.gamesGrid.innerHTML = '';

  if (filtered.length === 0) {
    els.catalogStatus.hidden = false;
    if (totalGames === 0) {
      els.catalogStatus.textContent = 'No games in games.json yet. Click "Add Iframe" to add a game or populate public/games.json.';
    } else if (state.category === 'favorites' && state.favorites.length === 0) {
      els.catalogStatus.textContent = 'No favorite games saved yet. Click Save on any game card to pin it here.';
    } else {
      els.catalogStatus.textContent = 'No games matched your current filter or search query.';
    }
    return;
  }

  els.catalogStatus.hidden = true;

  const fragment = document.createDocumentFragment();
  filtered.forEach((game) => {
    const isFav = state.favorites.includes(game.id);

    const card = document.createElement('article');
    card.className = 'game-card';

    const thumbUrl = resolveAssetUrl(game.thumbnail);
    const media = document.createElement('div');
    media.className = 'card-media';
    if (!thumbUrl) {
      media.classList.add('is-broken');
    }

    const img = document.createElement('img');
    if (thumbUrl) {
      img.src = thumbUrl;
    }
    img.alt = `${game.title} thumbnail`;
    img.loading = 'lazy';
    img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => {
      media.classList.add('is-broken');
    });

    const fallback = document.createElement('div');
    fallback.className = 'media-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    const fallbackLabel = document.createElement('span');
    fallbackLabel.className = 'fallback-label';
    fallbackLabel.textContent = game.title;
    fallback.appendChild(fallbackLabel);

    media.append(img, fallback);

    const body = document.createElement('div');
    body.className = 'card-body';

    const titleEl = document.createElement('h3');
    titleEl.className = 'card-title';
    titleEl.textContent = game.title;

    const metaEl = document.createElement('p');
    metaEl.className = 'card-meta';
    metaEl.textContent = game.controls ? `${game.category} · ${game.controls}` : game.category;

    const descEl = document.createElement('p');
    descEl.className = 'card-desc';
    descEl.textContent = game.description || 'Playable browser iframe game.';

    body.append(titleEl, metaEl, descEl);

    const actions = document.createElement('div');
    actions.className = 'card-actions';

    const playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'btn btn-primary card-play-btn';
    playBtn.textContent = 'Play';
    playBtn.addEventListener('click', () => launchGame(game.id));

    const favBtn = document.createElement('button');
    favBtn.type = 'button';
    favBtn.className = 'btn btn-secondary fav-toggle-btn';
    favBtn.setAttribute('aria-pressed', String(isFav));
    favBtn.setAttribute('aria-label', isFav ? `Remove ${game.title} from favorites` : `Save ${game.title} to favorites`);
    favBtn.textContent = isFav ? 'Saved' : 'Save';
    favBtn.addEventListener('click', () => toggleFavorite(game.id));

    actions.append(playBtn, favBtn);

    if (game.isCustom) {
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-ghost btn-icon';
      delBtn.setAttribute('aria-label', `Remove custom game ${game.title}`);
      delBtn.innerHTML =
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>';
      delBtn.addEventListener('click', () => removeCustomGame(game.id));
      actions.appendChild(delBtn);
    }

    card.append(media, body, actions);
    fragment.appendChild(card);
  });

  els.gamesGrid.appendChild(fragment);
}

function toggleFavorite(gameId) {
  const index = state.favorites.indexOf(gameId);
  if (index === -1) {
    state.favorites.unshift(gameId);
    showToast('Added to favorites');
  } else {
    state.favorites.splice(index, 1);
    showToast('Removed from favorites');
  }
  writeStorageArray(STORAGE_FAVORITES_KEY, state.favorites);
  renderCatalog();

  if (state.activeGameId === gameId) {
    updateStageFavoriteButton();
  }
}

function removeCustomGame(gameId) {
  state.customGames = state.customGames.filter((g) => g.id !== gameId);
  writeStorageArray(STORAGE_CUSTOM_GAMES_KEY, state.customGames);
  state.favorites = state.favorites.filter((id) => id !== gameId);
  writeStorageArray(STORAGE_FAVORITES_KEY, state.favorites);
  renderFeatured();
  renderCatalog();
  showToast('Custom game removed');
}

function updateStageFavoriteButton() {
  const isFav = state.favorites.includes(state.activeGameId);
  els.stageFavoriteBtn.setAttribute('aria-pressed', String(isFav));
  els.stageFavoriteBtn.textContent = isFav ? 'Saved Favorite' : 'Save Favorite';
}

function launchGame(gameId) {
  const game = getAllGames().find((g) => g.id === gameId);
  if (!game) return;

  const frame = buildSafeIframe(game.iframe, game.title);
  if (!frame) {
    showToast('This game has an invalid iframe entry.');
    return;
  }

  state.activeGameId = game.id;
  state.recentIds = [game.id, ...state.recentIds.filter((id) => id !== game.id)].slice(0, 15);
  writeStorageArray(STORAGE_RECENT_KEY, state.recentIds);

  els.stageGameTitle.textContent = game.title;
  els.stageGameMeta.textContent = game.controls ? `${game.category} · ${game.controls}` : game.category;
  updateStageFavoriteButton();

  els.stageIframeMount.innerHTML = '';
  els.stageIframeMount.appendChild(frame);

  const cleanEntry = {
    id: game.id,
    title: game.title,
    category: game.category,
    controls: game.controls,
    description: game.description,
    thumbnail: game.thumbnail || '',
    iframe: game.iframe,
  };
  els.stageJsonCode.textContent = JSON.stringify(cleanEntry, null, 2);
  els.stageJsonDrawer.hidden = true;
  els.stageJsonBtn.setAttribute('aria-expanded', 'false');

  els.libraryView.hidden = true;
  els.playerStage.hidden = false;
  window.scrollTo({ top: 0, behavior: 'instant' });

  frame.addEventListener('load', () => {
    try {
      frame.focus();
    } catch {
      // Ignore cross-origin focus blocks
    }
  });
}

function closeStage() {
  state.activeGameId = null;
  els.stageIframeMount.innerHTML = '';
  els.playerStage.hidden = true;
  els.libraryView.hidden = false;
  renderCatalog();
}

function openModal(modalEl) {
  modalEl.hidden = false;
  const firstInput = modalEl.querySelector('input, textarea, button');
  if (firstInput) firstInput.focus();
}

function closeModal(modalEl) {
  modalEl.hidden = true;
}

function getExportableCatalogJson() {
  const exported = getAllGames().map((game) => ({
    id: game.id,
    title: game.title,
    category: game.category,
    controls: game.controls,
    description: game.description,
    thumbnail: game.thumbnail || '',
    iframe: game.iframe,
  }));
  return JSON.stringify(exported, null, 2);
}

function downloadGamesJson() {
  const jsonText = getExportableCatalogJson();
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'games.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Downloaded games.json');
}

async function copyText(text, successMsg) {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg);
  } catch {
    showToast('Clipboard permission unavailable');
  }
}

function bindEvents() {
  els.brandHomeLink.addEventListener('click', (e) => {
    e.preventDefault();
    if (!els.playerStage.hidden) {
      closeStage();
    }
    state.category = 'all';
    renderCatalog();
  });

  els.navLinks.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!els.playerStage.hidden) {
        closeStage();
      }
      state.category = btn.dataset.category || 'all';
      renderCatalog();
    });
  });

  els.mobileCategorySelect.addEventListener('change', (e) => {
    state.category = e.target.value;
    renderCatalog();
  });

  els.searchInput.addEventListener('input', (e) => {
    state.search = e.target.value;
    renderCatalog();
  });

  els.sortSelect.addEventListener('change', (e) => {
    state.sort = e.target.value;
    renderCatalog();
  });

  els.randomGameBtn.addEventListener('click', () => {
    const games = getAllGames();
    if (games.length === 0) return;
    const random = games[Math.floor(Math.random() * games.length)];
    launchGame(random.id);
  });

  els.backToLibraryBtn.addEventListener('click', closeStage);

  els.stageFavoriteBtn.addEventListener('click', () => {
    if (state.activeGameId) {
      toggleFavorite(state.activeGameId);
    }
  });

  els.stageReloadBtn.addEventListener('click', () => {
    if (state.activeGameId) {
      launchGame(state.activeGameId);
      showToast('Game reloaded');
    }
  });

  els.stageJsonBtn.addEventListener('click', () => {
    const willOpen = els.stageJsonDrawer.hidden;
    els.stageJsonDrawer.hidden = !willOpen;
    els.stageJsonBtn.setAttribute('aria-expanded', String(willOpen));
  });

  els.copyEntryJsonBtn.addEventListener('click', () => {
    copyText(els.stageJsonCode.textContent || '', 'Entry JSON copied');
  });

  els.stageFullscreenBtn.addEventListener('click', () => {
    const target = els.stageIframeWrapper;
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else if (target.requestFullscreen) {
      target.requestFullscreen().catch(() => {
        showToast('Fullscreen unavailable in this frame');
      });
    }
  });

  // Add Iframe Modal
  els.openAddModalBtn.addEventListener('click', () => {
    els.addFormError.hidden = true;
    els.addGameForm.reset();
    openModal(els.addModal);
  });

  els.closeAddModalBtn.addEventListener('click', () => closeModal(els.addModal));
  els.cancelAddModalBtn.addEventListener('click', () => closeModal(els.addModal));

  els.addModal.addEventListener('click', (e) => {
    if (e.target === els.addModal) closeModal(els.addModal);
  });

  els.addGameForm.addEventListener('submit', (e) => {
    e.preventDefault();
    els.addFormError.hidden = true;

    const formData = new FormData(els.addGameForm);
    const title = String(formData.get('title') || '').trim();
    const category = String(formData.get('category') || 'Arcade');
    const controls = String(formData.get('controls') || '').trim() || 'Keyboard or Mouse';
    const description = String(formData.get('description') || '').trim() || 'Custom embedded iframe game.';
    const rawIframe = String(formData.get('iframe') || '');

    if (!title) {
      els.addFormError.textContent = 'Please enter a game title.';
      els.addFormError.hidden = false;
      return;
    }

    const normalized = normalizeIframeInput(rawIframe, title);
    if (normalized.error) {
      els.addFormError.textContent = normalized.error;
      els.addFormError.hidden = false;
      return;
    }

    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'custom'}-${Date.now().toString(36)}`;
    const newGame = {
      id: slug,
      title,
      category,
      controls,
      description,
      thumbnail: '',
      iframe: normalized.iframe,
      isCustom: true,
    };

    state.customGames.push(newGame);
    writeStorageArray(STORAGE_CUSTOM_GAMES_KEY, state.customGames);

    closeModal(els.addModal);
    if (!els.playerStage.hidden) {
      closeStage();
    }
    state.category = 'all';
    renderFeatured();
    renderCatalog();
    showToast(`Added "${title}" to catalog`);
  });

  // Inspect games.json Modal
  els.viewCatalogJsonBtn.addEventListener('click', () => {
    els.fullJsonCode.textContent = getExportableCatalogJson();
    openModal(els.jsonModal);
  });

  els.closeJsonModalBtn.addEventListener('click', () => closeModal(els.jsonModal));
  els.jsonModal.addEventListener('click', (e) => {
    if (e.target === els.jsonModal) closeModal(els.jsonModal);
  });

  els.copyAllJsonBtn.addEventListener('click', () => {
    copyText(els.fullJsonCode.textContent || '', 'Copied games.json');
  });

  els.downloadAllJsonBtn.addEventListener('click', downloadGamesJson);
  els.exportJsonBtn.addEventListener('click', downloadGamesJson);

  els.resetCustomBtn.addEventListener('click', () => {
    state.customGames = [];
    writeStorageArray(STORAGE_CUSTOM_GAMES_KEY, []);
    renderFeatured();
    renderCatalog();
    showToast('Cleared custom iframe entries');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!els.addModal.hidden) closeModal(els.addModal);
      if (!els.jsonModal.hidden) closeModal(els.jsonModal);
    }
  });
}

async function loadCatalog() {
  const candidates = [
    { url: './games.json', base: './' },
    { url: './public/games.json', base: './public/' },
  ];

  for (const candidate of candidates) {
    try {
      const response = await fetch(candidate.url);
      if (!response.ok) continue;
      const data = await response.json();
      if (Array.isArray(data)) {
        state.publicBase = candidate.base;
        return data;
      }
    } catch {
      // Try next candidate
    }
  }
  throw new Error('Catalog not found');
}

export async function startApp() {
  state.favorites = readStorageArray(STORAGE_FAVORITES_KEY);
  state.recentIds = readStorageArray(STORAGE_RECENT_KEY);
  state.customGames = readStorageArray(STORAGE_CUSTOM_GAMES_KEY);

  bindEvents();

  try {
    state.baseGames = await loadCatalog();
    renderFeatured();
    renderCatalog();
  } catch {
    els.catalogStatus.hidden = false;
    els.catalogStatus.textContent = 'Unable to load games.json. Check that games.json exists and contains valid JSON.';
    els.featuredTitle.textContent = 'Catalog unavailable';
  }
}
