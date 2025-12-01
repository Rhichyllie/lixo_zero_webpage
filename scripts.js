/**
 * Lixo Zero Express – scripts.js
 * -----------------------------------------------------------------------------
 * Responsável por carregar o conteúdo dinâmico (JSON), mapear ecopontos,
 * controlar filtros, lightbox, modo escuro, compartilhamento e QR Code.
 * Atualize content/projects.json para incluir novos projetos, pontos ou eventos.
 * -----------------------------------------------------------------------------
 */
const DATA_URL = 'content/projects.json';
const MAP_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const MAP_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contribuidores';
const MAP_CATEGORY_META = {
  'Recicláveis': { icon: '♻️', label: 'Recicláveis' },
  'Vidro': { icon: '🪟', label: 'Vidro' },
  'Óleo': { icon: '🛢️', label: 'Óleo' },
  'Eletrônicos': { icon: '🔌', label: 'Eletrônicos' }
};

function getCategoryMeta(type) {
  return MAP_CATEGORY_META[type] ?? { icon: '📍', label: type };
}


const SELECTORS = {
  heroQr: '#heroQr',
  projectGrid: '#project-grid',
  projectFilters: '#project-filters',
  projectSearch: '#project-search',
  projectEmpty: '#project-empty',
  mapFilters: '#map-filters',
  mapList: '#map-list',
  mapCanvas: '#map',
  agendaList: '#agenda-list',
  agendaCta: '#agenda-cta',
  partnerSection: '#parceiro',
  partnerImage: '#partner-image',
  partnerFallback: '#partner-fallback',
  partnerTitle: '#partner-title',
  partnerAbout: '#partner-about',
  partnerMaps: '#partner-maps',
  partnerSite: '#partner-site',
  partnerTips: '#partner-tips',
  partnerTipsCard: '#partner-tips-card',
  teamList: '#team-list',
  termLabel: '#term-label',
  courseLabel: '#course-label',
  referencesList: '#references-list'
};

const STATE = {
  data: null,
  mapInstance: null,
  mapLayers: new Map(),
  mapPoints: [],
  markersByName: new Map(),
  lightbox: null,
  activeMapTypes: new Set(),
  activeProjectTags: new Set(),
  availableTags: [],
  projectSearchTerm: '',
  allProjects: []
};

const STORAGE_KEYS = {
  projectTags: 'lz-project-tags',
  projectSearch: 'lz-project-search'
};

const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

window.addEventListener('DOMContentLoaded', init);

async function init() {
  handleThemeOnLoad();
  setupThemeToggle();
  setupShare();
  setupQrDownload();
  setupHeroQrShortcut();
  setupNavigationToggle();

  const data = await loadContent();
  if (!data) return;

  STATE.data = data;
  populateAbout(data.about);
  populateReferences(data.refs);
  renderAgendaCta(data.agendaCta);
  populateAgenda(data.events);
  initMap(data.map?.points ?? []);
  renderPartnerSection(data.partner);
  initProjects(data.projects ?? []);
  injectStructuredData(data);
}

function handleThemeOnLoad() {
  const stored = localStorage.getItem('lz-theme');
  if (stored === 'light' || stored === 'dark') {
    document.body.dataset.theme = stored;
    updateThemeToggleLabel(stored);
    return;
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.body.dataset.theme = prefersDark ? 'dark' : 'light';
  updateThemeToggleLabel(document.body.dataset.theme);
}

function setupThemeToggle() {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const current = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.dataset.theme = next;
    localStorage.setItem('lz-theme', next);
    updateThemeToggleLabel(next);
  });
}

function updateThemeToggleLabel(theme) {
  const toggle = document.getElementById('themeToggle');
  if (!toggle) return;
  const label = toggle.querySelector('.theme-toggle__label');
  if (label) {
    label.textContent = theme === 'dark' ? 'Modo claro' : 'Modo escuro';
  }
  toggle.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
}

function setupShare() {
  const button = document.getElementById('shareButton');
  if (!button) return;
  button.addEventListener('click', async () => {
    const shareData = {
      title: document.title,
      text: 'Conheça o Lixo Zero Express: guia de separação, mapa de ecopontos e projetos da Semana Lixo Zero UNIVALI.',
      url: window.location.href
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareData.url);
        button.setAttribute('data-feedback', 'Link copiado!');
        button.classList.add('chip--brand');
        setTimeout(() => {
          button.classList.remove('chip--brand');
          button.removeAttribute('data-feedback');
        }, 2000);
        alert('Link copiado para a área de transferência.');
      } else {
        window.prompt('Copie o link para compartilhar:', shareData.url);
      }
    } catch (error) {
      console.error('Falha ao compartilhar', error);
      alert('Não foi possível compartilhar agora. Tente novamente em instantes.');
    }
  });
}

function setupQrDownload() {
  const button = document.getElementById('qrButton');
  if (!button) return;

  button.addEventListener('click', async () => {
    const label = button.querySelector('span:last-child');
    const originalText = label ? label.textContent : 'Baixar QR';
    const apiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=1000x1000&data=${encodeURIComponent(
      window.location.href
    )}`;

    try {
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      if (label) label.textContent = 'Gerando...';

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Resposta inesperada: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = 'lixo-zero-express-qr.png';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Erro ao gerar QR Code', error);
      alert('Não foi possível gerar o QR Code agora. Tente novamente em instantes.');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
      if (label) label.textContent = originalText;
    }
  });
}

function setupHeroQrShortcut() {
  const heroButton = document.querySelector(SELECTORS.heroQr);
  const mainButton = document.getElementById('qrButton');
  if (!heroButton || !mainButton) return;
  heroButton.addEventListener('click', (event) => {
    event.preventDefault();
    mainButton.click();
  });
}

function setupNavigationToggle() {
  const toggle = document.getElementById('menuToggle');
  const navWrapper = document.getElementById('topbarNav');
  const topbar = document.querySelector('.topbar');
  const mobileQuery = window.matchMedia('(max-width: 1023px)');
  if (!toggle || !navWrapper || !topbar) return;

  const closeMenu = () => {
    topbar.classList.remove('topbar--open');
    toggle.setAttribute('aria-expanded', 'false');
    if (mobileQuery.matches) {
      navWrapper.setAttribute('hidden', '');
      navWrapper.setAttribute('aria-hidden', 'true');
    } else {
      navWrapper.removeAttribute('aria-hidden');
    }
  };

  const syncForViewport = () => {
    if (!mobileQuery.matches) {
      navWrapper.removeAttribute('hidden');
      navWrapper.removeAttribute('aria-hidden');
      topbar.classList.remove('topbar--open');
      toggle.setAttribute('aria-expanded', 'false');
    } else {
      closeMenu();
    }
  };

  toggle.addEventListener('click', () => {
    const isOpen = topbar.classList.toggle('topbar--open');
    toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    if (mobileQuery.matches) {
      navWrapper.toggleAttribute('hidden', !isOpen);
      navWrapper.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
    } else {
      navWrapper.removeAttribute('aria-hidden');
    }
  });

  navWrapper.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      if (mobileQuery.matches) {
        closeMenu();
      }
    });
  });

  document.addEventListener('keyup', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });

  mobileQuery.addEventListener('change', syncForViewport);
  syncForViewport();
}

async function loadContent() {
  try {
    const response = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`Falha ao carregar JSON (${response.status})`);
    }
    return await response.json();
  } catch (error) {
    console.error('Não foi possível carregar os dados', error);
    const grid = document.querySelector(SELECTORS.projectGrid);
    if (grid) {
      grid.setAttribute('aria-busy', 'false');
      grid.innerHTML =
        '<p role="status">Erro ao carregar conteúdo. Recarregue a página ou tente novamente mais tarde.</p>';
    }
    return null;
  }
}

function populateAbout(about) {
  if (!about) return;
  const teamList = document.querySelector(SELECTORS.teamList);
  const termLabel = document.querySelector(SELECTORS.termLabel);
  const courseLabel = document.querySelector(SELECTORS.courseLabel);

  if (Array.isArray(about.team) && teamList) {
    teamList.innerHTML = '';
    const fragment = document.createDocumentFragment();
    about.team.forEach((member) => {
      const li = document.createElement('li');
      li.textContent = member;
      fragment.appendChild(li);
    });
    teamList.appendChild(fragment);
  }

  if (termLabel && about.term) {
    termLabel.textContent = about.term;
  }

  if (courseLabel && about.course && about.university) {
    courseLabel.textContent = `${about.course} • ${about.university}`;
  }
}

function populateReferences(refs) {
  const list = document.querySelector(SELECTORS.referencesList);
  if (!list) return;
  list.innerHTML = '';

  const getHost = (url) => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'Fonte oficial';
    }
  };

  if (!Array.isArray(refs) || refs.length === 0) {
    const item = document.createElement('li');
    item.className = 'reference-card reference-card--empty';
    item.textContent = 'Referências serão publicadas em breve.';
    list.appendChild(item);
    return;
  }

  const fragment = document.createDocumentFragment();
  refs.forEach((ref) => {
    const li = document.createElement('li');
    li.className = 'reference-card';

    const title = document.createElement('strong');
    title.textContent = ref.label;

    const meta = document.createElement('span');
    meta.className = 'reference-card__meta';
    meta.textContent = getHost(ref.url);

    const anchor = document.createElement('a');
    anchor.href = ref.url;
    anchor.textContent = 'Abrir referência';
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    anchor.className = 'reference-card__link';
    anchor.setAttribute('aria-label', `${ref.label} (abre em nova aba)`);
    li.append(title, meta, anchor);
    fragment.appendChild(li);
  });
  list.appendChild(fragment);
}

function renderAgendaCta(agendaCta) {
  const container = document.querySelector(SELECTORS.agendaCta);
  if (!container) return;
  container.innerHTML = '';

  if (!agendaCta) {
    container.hidden = true;
    return;
  }

  container.hidden = false;
  const titleId = 'agenda-cta-title';

  container.innerHTML = `
    <div class="callout" role="region" aria-labelledby="${titleId}">
      <span class="callout__icon" aria-hidden="true">📅</span>
      <div>
        <p class="kicker">Agenda colaborativa</p>
        <h3 id="${titleId}">${agendaCta.title}</h3>
        <p>${agendaCta.text}</p>
      </div>
      <div class="button-grid button-grid--inline">
        ${agendaCta.site ? `<a class="button button--brand" href="${agendaCta.site}" target="_blank" rel="noopener">Ver agenda final</a>` : ''}
        ${agendaCta.instagram ? `<a class="button button--ghost" href="${agendaCta.instagram}" target="_blank" rel="noopener">Instagram @itajai.lixozero</a>` : ''}
      </div>
    </div>
  `;
}

function populateAgenda(events) {
  const list = document.querySelector(SELECTORS.agendaList);
  if (!list) return;
  list.innerHTML = '';

  if (!Array.isArray(events) || events.length === 0) {
    const empty = document.createElement('p');
    empty.textContent = 'Ainda não há eventos confirmados. Volte em breve!';
    list.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  events.forEach((event) => {
    const card = document.createElement('article');
    card.className = 'agenda-card';
    card.setAttribute('role', 'listitem');

    const startDate = new Date(event.date);
    const endDate = event.end ? new Date(event.end) : null;
    const longFormatter = new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long'
    });
    const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const dateLabel = longFormatter.format(startDate);
    const timeLabel = `${timeFormatter.format(startDate)}${
      endDate ? ` – ${timeFormatter.format(endDate)}` : ''
    }`;

    card.innerHTML = `
      <div class="agenda-card__meta">
        <time datetime="${event.date}">${dateLabel}</time><br/>
        ${timeLabel} • ${event.mode === 'online' ? 'Online' : 'Presencial'}
      </div>
      <h3>${event.title}</h3>
      <p>${event.summary ?? ''}</p>
      <p class="agenda-card__meta">${event.location}</p>
      <a class="button button--ghost agenda-card__cta" href="${event.cta}" target="_blank" rel="noopener">
        Inscrever-se
      </a>
    `;
    fragment.appendChild(card);
  });
  list.appendChild(fragment);
}

function initMap(points) {
  const mapEl = document.querySelector(SELECTORS.mapCanvas);
  const filterContainer = document.querySelector(SELECTORS.mapFilters);
  const listEl = document.querySelector(SELECTORS.mapList);

  if (!mapEl || typeof L === 'undefined') {
    if (mapEl) {
      mapEl.innerHTML = '<p role="status">Mapa indisponível no momento. Verifique sua conexão.</p>';
    }
    return;
  }

  const map = L.map(mapEl, { scrollWheelZoom: false });
  L.tileLayer(MAP_TILE_URL, { attribution: MAP_ATTRIBUTION, maxZoom: 19 }).addTo(map);
  STATE.mapInstance = map;
  STATE.mapLayers = new Map();
  STATE.mapPoints = Array.isArray(points) ? points : [];
  STATE.markersByName = new Map();

  if (!Array.isArray(points) || points.length === 0) {
    if (listEl) {
      listEl.innerHTML = '<p role="status">Nenhum ponto cadastrado ainda. Volte em breve!</p>';
    }
    return;
  }

  const bounds = [];
  const groups = {};
  const listItemsByType = new Map();
  const categories = Array.from(new Set(points.map((p) => p.type))).sort();
  STATE.activeMapTypes = new Set(categories);

  categories.forEach((category) => {
    const group = L.layerGroup();
    groups[category] = group;
    STATE.mapLayers.set(category, group);
    group.addTo(map);
  });

  points.forEach((point) => {
    const marker = L.marker([point.lat, point.lng]);
    marker.bindPopup(
      '<strong>' + point.name + '</strong><br/><span>' + (point.info ?? 'Sem informações adicionais') + '</span>'
    );
    marker.addTo(groups[point.type] ?? map);
    marker.pointData = point;
    bounds.push([point.lat, point.lng]);
    STATE.markersByName.set(point.name, marker);

    if (!listItemsByType.has(point.type)) {
      listItemsByType.set(point.type, []);
    }
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [32, 48] });
  }

  if (filterContainer) {
    filterContainer.innerHTML = '';
    categories.forEach((category) => {
      const meta = getCategoryMeta(category);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-filter map-filter--active';
      button.dataset.type = category;
      button.setAttribute('aria-pressed', 'true');

      const iconSpan = document.createElement('span');
      iconSpan.className = 'map-filter__icon';
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.textContent = meta.icon;

      const labelSpan = document.createElement('span');
      labelSpan.textContent = meta.label;

      button.append(iconSpan, labelSpan);

      button.addEventListener('click', () => {
        const isActive = STATE.activeMapTypes.has(category);
        if (isActive && STATE.activeMapTypes.size === 1) {
          return;
        }
        if (isActive) {
          STATE.activeMapTypes.delete(category);
          map.removeLayer(groups[category]);
        } else {
          STATE.activeMapTypes.add(category);
          groups[category].addTo(map);
        }
        const nowActive = STATE.activeMapTypes.has(category);
        button.setAttribute('aria-pressed', nowActive ? 'true' : 'false');
        button.classList.toggle('map-filter--active', nowActive);
        updateListVisibility();
      });

      filterContainer.appendChild(button);
    });
  }

  if (listEl) {
    listEl.innerHTML = '';
    const fragment = document.createDocumentFragment();
    points.forEach((point) => {
      const meta = getCategoryMeta(point.type);
      const li = document.createElement('li');
      li.className = 'map-item';
      li.dataset.type = point.type;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'map-item__button';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'map-item__icon';
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.textContent = meta.icon;

      const contentSpan = document.createElement('span');
      contentSpan.className = 'map-item__content';

      const titleEl = document.createElement('strong');
      titleEl.textContent = point.name;

      const metaSpan = document.createElement('span');
      metaSpan.className = 'map-item__meta';
      metaSpan.textContent = meta.label + ' • ' + (point.info ?? 'Sem horário informado');

      contentSpan.append(titleEl, metaSpan);
      button.append(iconSpan, contentSpan);

      button.setAttribute('aria-label', 'Focar ' + point.name + ' no mapa');
      button.addEventListener('click', () => {
        focusMarkerByName(point.name);
      });

      li.appendChild(button);
      fragment.appendChild(li);
      listItemsByType.get(point.type).push(li);
    });
    listEl.appendChild(fragment);
    updateListVisibility();
  }

  function updateListVisibility() {
    if (!listEl) return;
    listItemsByType.forEach((items, type) => {
      const visible = STATE.activeMapTypes.has(type);
      items.forEach((item) => {
        item.hidden = !visible;
      });
    });
  }
}

function renderPartnerSection(partner) {
  const section = document.querySelector(SELECTORS.partnerSection);
  const image = document.querySelector(SELECTORS.partnerImage);
  const fallback = document.querySelector(SELECTORS.partnerFallback);
  const titleEl = document.querySelector(SELECTORS.partnerTitle);
  const aboutEl = document.querySelector(SELECTORS.partnerAbout);
  const mapsButton = document.querySelector(SELECTORS.partnerMaps);
  const siteButton = document.querySelector(SELECTORS.partnerSite);
  const tipsList = document.querySelector(SELECTORS.partnerTips);
  const tipsCard = document.querySelector(SELECTORS.partnerTipsCard);

  if (!section) return;

  if (!partner) {
    section.hidden = true;
    return;
  }

  section.hidden = false;
  const partnerName = partner.name ?? 'Parceiro da comunidade';
  const aboutText =
    partner.about ??
    'Cooperativa de reciclagem que fortalece a triagem solidária e gera renda para famílias catadoras.';

  if (titleEl) {
    titleEl.textContent = 'Parceiro da Comunidade: ' + partnerName;
  }

  if (aboutEl) {
    aboutEl.textContent = aboutText;
  }

  if (mapsButton) {
    if (partner.maps) {
      mapsButton.href = partner.maps;
      mapsButton.hidden = false;
      mapsButton.setAttribute('aria-label', 'Abrir rota para ' + partnerName + ' no Google Maps');
    } else {
      mapsButton.hidden = true;
    }
  }

  if (siteButton) {
    if (partner.site) {
      siteButton.href = partner.site;
      const label = partnerName.toLowerCase().includes('cooperfoz')
        ? 'Conhecer a Cooperfoz'
        : 'Conhecer ' + partnerName;
      siteButton.textContent = label;
      siteButton.hidden = false;
      siteButton.setAttribute('aria-label', 'Visitar site de ' + partnerName);
    } else {
      siteButton.hidden = true;
    }
  }

  if (tipsList) {
    tipsList.innerHTML = '';
    const tips = Array.isArray(partner.tips) ? partner.tips : [];
    if (tips.length > 0) {
      tips.forEach((tip) => {
        const li = document.createElement('li');
        li.textContent = tip;
        tipsList.appendChild(li);
      });
      if (tipsCard) tipsCard.hidden = false;
    } else if (tipsCard) {
      tipsCard.hidden = true;
    }
  }

  if (fallback) {
    fallback.textContent = partnerName.split(' ').slice(0, 2).join(' ').toUpperCase();
    fallback.hidden = true;
    fallback.setAttribute('aria-hidden', 'true');
  }

  if (image) {
    const defaultSrc = 'assets/partners/cooperfoz.svg';
    const candidate = partner.image ?? defaultSrc;
    image.alt = 'Logotipo da ' + partnerName;
    image.hidden = false;
    image.src = candidate;
    image.addEventListener(
      'error',
      () => {
        image.hidden = true;
        if (fallback) {
          fallback.hidden = false;
          fallback.removeAttribute('aria-hidden');
        }
      },
      { once: true }
    );
    image.addEventListener(
      'load',
      () => {
        if (fallback) {
          fallback.hidden = true;
          fallback.setAttribute('aria-hidden', 'true');
        }
      },
      { once: true }
    );
  }
}
function initProjects(projects) {
  const grid = document.querySelector(SELECTORS.projectGrid);
  const filtersEl = document.querySelector(SELECTORS.projectFilters);
  const searchInput = document.querySelector(SELECTORS.projectSearch);
  const emptyState = document.querySelector(SELECTORS.projectEmpty);

  if (!grid) return;

  STATE.allProjects = Array.isArray(projects) ? projects : [];

  const allTags = Array.from(
    new Set(
      STATE.allProjects.flatMap((project) =>
        Array.isArray(project.tags) ? project.tags : []
      )
    )
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'));

  STATE.availableTags = allTags;

  let storedTags = [];
  try {
    storedTags = JSON.parse(localStorage.getItem(STORAGE_KEYS.projectTags) ?? '[]');
  } catch {
    storedTags = [];
  }
  const validStored = storedTags.filter((tag) => allTags.includes(tag));
  STATE.activeProjectTags =
    validStored.length > 0 ? new Set(validStored) : new Set(allTags);

  const storedSearch = localStorage.getItem(STORAGE_KEYS.projectSearch);
  STATE.projectSearchTerm = storedSearch ?? '';
  if (searchInput && STATE.projectSearchTerm) {
    searchInput.value = STATE.projectSearchTerm;
  }

  if (filtersEl) {
    buildTagChips(filtersEl);
  }

  if (searchInput) {
    searchInput.addEventListener('input', (event) => {
      STATE.projectSearchTerm = event.target.value;
      localStorage.setItem(STORAGE_KEYS.projectSearch, STATE.projectSearchTerm);
      render();
    });
  }

  render();

  function buildTagChips(container) {
    container.innerHTML = '';
    if (allTags.length === 0) {
      container.hidden = true;
      return;
    }
    container.hidden = false;

    const tagCounts = new Map();
    STATE.allProjects.forEach((project) => {
      (Array.isArray(project.tags) ? project.tags : []).forEach((tag) => {
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      });
    });

    allTags.forEach((tag) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'chip chip--theme';
      button.dataset.tag = tag;
      button.textContent = tag + ' (' + (tagCounts.get(tag) ?? 0) + ')';
      button.addEventListener('click', () => {
        const allSelected = STATE.activeProjectTags.size === allTags.length;
        if (STATE.activeProjectTags.has(tag)) {
          STATE.activeProjectTags.delete(tag);
          if (STATE.activeProjectTags.size === 0) {
            STATE.activeProjectTags = new Set(allTags);
          }
        } else if (allSelected) {
          STATE.activeProjectTags = new Set([tag]);
        } else {
          STATE.activeProjectTags.add(tag);
        }

        persistSelection();
        updateChipState(container);
        render();
      });
      container.appendChild(button);
    });

    updateChipState(container);
  }

  function updateChipState(container) {
    const buttons = container.querySelectorAll('button[data-tag]');
    const activeTags = STATE.activeProjectTags;
    const showAll = activeTags.size === allTags.length;
    buttons.forEach((button) => {
      const tag = button.dataset.tag;
      const isActive = showAll || activeTags.has(tag);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
      button.classList.toggle('chip--active', isActive);
    });
  }

  function persistSelection() {
    const payload = STATE.activeProjectTags.size === allTags.length
      ? []
      : Array.from(STATE.activeProjectTags);
    localStorage.setItem(STORAGE_KEYS.projectTags, JSON.stringify(payload));
  }

  function render() {
    grid.innerHTML = '';
    grid.setAttribute('aria-busy', 'true');

    const term = STATE.projectSearchTerm.trim().toLowerCase();
    const activeTags = STATE.activeProjectTags;
    const showAllTags = activeTags.size === allTags.length;

    const filtered = STATE.allProjects.filter((project) => {
      const tags = Array.isArray(project.tags) ? project.tags : [];
      const matchesTags = showAllTags || tags.some((tag) => activeTags.has(tag));
      if (!matchesTags) return false;
      if (!term) return true;
      const haystack = [project.title, project.desc, ...tags].join(' ').toLowerCase();
      return haystack.includes(term);
    });

    const fragment = document.createDocumentFragment();
    filtered.forEach((project) => {
      fragment.appendChild(renderProjectCard(project));
    });
    grid.appendChild(fragment);
    grid.setAttribute('aria-busy', 'false');

    if (emptyState) {
      emptyState.hidden = filtered.length > 0;
    }

    if (typeof GLightbox === 'function') {
      if (STATE.lightbox) {
        STATE.lightbox.destroy();
      }
      STATE.lightbox = GLightbox({
        selector: '.js-lightbox',
        touchNavigation: true,
        loop: false,
        openEffect: prefersReducedMotion.matches ? 'none' : 'zoom',
        closeEffect: prefersReducedMotion.matches ? 'none' : 'fade'
      });
    }
  }
}

function renderProjectCard(project) {
  const card = document.createElement('article');
  card.className = 'project-card';
  card.setAttribute('role', 'listitem');

  const media = document.createElement('div');
  media.className = 'project-card__media';

  if (project.thumb) {
    const img = document.createElement('img');
    img.src = project.thumb;
    img.alt = 'Miniatura do projeto ' + project.title;
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 320;
    img.height = 180;
    media.appendChild(img);
  } else {
    const placeholder = document.createElement('div');
    placeholder.className = 'project-card__placeholder';
    const fallbackLabel = (project.tags && project.tags[0]) || project.type || 'Projeto';
    placeholder.textContent = fallbackLabel;
    media.appendChild(placeholder);
  }

  const body = document.createElement('div');
  body.className = 'project-card__body';

  const title = document.createElement('h3');
  title.textContent = project.title;
  body.appendChild(title);

  if (project.desc) {
    const desc = document.createElement('p');
    desc.textContent = project.desc;
    body.appendChild(desc);
  }

  if (Array.isArray(project.tags) && project.tags.length > 0) {
    const tags = document.createElement('div');
    tags.className = 'tag-group';
    project.tags.forEach((tagLabel) => {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = tagLabel;
      tags.appendChild(tag);
    });
    body.appendChild(tags);
  }

  const footer = document.createElement('div');
  footer.className = 'project-card__footer';

  const lightboxConfig = getLightboxConfig(project);

  if (lightboxConfig) {
    const viewButton = document.createElement('a');
    viewButton.className = 'button button--ghost js-lightbox';
    viewButton.href = lightboxConfig.href;
    viewButton.dataset.type = lightboxConfig.type;
    viewButton.dataset.gallery = 'projects';
    viewButton.textContent = 'Visualizar';
    viewButton.setAttribute('aria-label', 'Visualizar ' + project.title);
    if (lightboxConfig.type === 'iframe') {
      viewButton.dataset.iframeTitle = 'Visualização do projeto ' + project.title;
      viewButton.dataset.iframeAllow = 'fullscreen';
    }
    footer.appendChild(viewButton);
  } else if (project.url) {
    const viewButton = document.createElement('a');
    viewButton.className = 'button button--ghost';
    viewButton.href = project.url;
    viewButton.target = '_blank';
    viewButton.rel = 'noopener noreferrer';
    viewButton.textContent = 'Visualizar';
    footer.appendChild(viewButton);
  }

  if (project.url) {
    const openOriginal = document.createElement('a');
    openOriginal.className = 'button button--brand';
    openOriginal.href = project.url;
    openOriginal.target = '_blank';
    openOriginal.rel = 'noopener noreferrer';
    openOriginal.textContent = 'Abrir original';
    openOriginal.setAttribute('aria-label', 'Abrir ' + project.title + ' em nova aba');
    footer.appendChild(openOriginal);
  }

  card.append(media, body, footer);
  return card;
}

function getLightboxConfig(project) {
  if (!project?.url) return null;
  switch (project.type) {
    case 'video': {
      const url = project.url;
      const youtubeMatch =
        url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/) || [];
      const videoId = youtubeMatch[1];
      const embedUrl = videoId
        ? `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`
        : url;
      return { href: embedUrl, type: 'video' };
    }
    case 'pdf': {
      const viewerUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(
        project.url
      )}`;
      return { href: viewerUrl, type: 'iframe' };
    }
    case 'image':
      return { href: project.url, type: 'image' };
    default:
      return null;
  }
}

function injectStructuredData(data) {
  if (!data) return;
  const graph = [];
  const baseUrl = window.location.origin + window.location.pathname.replace(/index\.html$/, '');

  if (Array.isArray(data.events)) {
    data.events.forEach((event) => {
      const isOnline = event.mode === 'online';
      graph.push({
        '@type': 'Event',
        name: event.title,
        startDate: event.date,
        endDate: event.end ?? undefined,
        eventAttendanceMode: isOnline
          ? 'https://schema.org/OnlineEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
        eventStatus: 'https://schema.org/EventScheduled',
        location: isOnline
          ? {
              '@type': 'VirtualLocation',
              url: event.cta
            }
          : {
              '@type': 'Place',
              name: event.location,
              address: event.location
            },
        organizer: {
          '@type': 'Organization',
          name: 'UNIVALI - Semana Lixo Zero'
        },
        description: event.summary,
        url: event.cta
      });
    });
  }

  if (Array.isArray(data.projects)) {
    data.projects.forEach((project) => {
      const absoluteThumb = project.thumb ? new URL(project.thumb, baseUrl).href : undefined;
      const commonFields = {
        name: project.title,
        description: project.desc,
        url: project.url,
        inLanguage: 'pt-BR',
        keywords: project.tags?.join(', ')
      };

      if (project.type === 'video') {
        graph.push({
          '@type': 'VideoObject',
          ...commonFields,
          thumbnailUrl: absoluteThumb ? [absoluteThumb] : undefined
        });
      } else if (project.type === 'pdf') {
        graph.push({
          '@type': 'CreativeWork',
          ...commonFields,
          encodingFormat: 'application/pdf',
          contentUrl: project.url,
          thumbnailUrl: absoluteThumb
        });
      } else if (project.type === 'image') {
        graph.push({
          '@type': 'ImageObject',
          ...commonFields,
          contentUrl: project.url,
          thumbnailUrl: absoluteThumb ? [absoluteThumb] : undefined
        });
      } else {
        graph.push({
          '@type': 'CreativeWork',
          ...commonFields,
          thumbnailUrl: absoluteThumb
        });
      }
    });
  }

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': graph
  });
  document.head.appendChild(script);
}

function focusMarkerByName(name) {
  if (!name || !STATE.mapInstance) return false;
  const marker = STATE.markersByName.get(name);
  if (!marker) return false;

  const pointType = marker.pointData?.type;
  if (pointType) {
    const layer = STATE.mapLayers.get(pointType);
    if (layer && !STATE.mapInstance.hasLayer(layer)) {
      layer.addTo(STATE.mapInstance);
    }
    STATE.activeMapTypes.add(pointType);

    const filterContainer = document.querySelector(SELECTORS.mapFilters);
    if (filterContainer) {
      const filterButton = filterContainer.querySelector('button[data-type="' + pointType + '"]');
      if (filterButton) {
        filterButton.setAttribute('aria-pressed', 'true');
        filterButton.classList.add('map-filter--active');
      }
    }

    const listEl = document.querySelector(SELECTORS.mapList);
    if (listEl) {
      listEl.querySelectorAll('li[data-type]').forEach((item) => {
        const visible = STATE.activeMapTypes.has(item.dataset.type);
        item.hidden = !visible;
      });
    }
  }

  const latLng = marker.getLatLng();
  STATE.mapInstance.setView(latLng, 15, { animate: !prefersReducedMotion.matches });
  marker.openPopup();
  const mapSection = document.getElementById('mapa');
  if (mapSection) {
    mapSection.scrollIntoView({ behavior: prefersReducedMotion.matches ? 'auto' : 'smooth' });
  }
  return true;
}
