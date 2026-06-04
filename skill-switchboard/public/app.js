'use strict';

const state = {
  categories: [],
  activeCategory: 'personal',
  activeSources: {},
  skills: [],
  query: ''
};

const categoryTabsEl = document.querySelector('#category-tabs');
const sourceTabsEl = document.querySelector('#source-tabs');
const categoryTitleEl = document.querySelector('#category-title');
const categoryDescriptionEl = document.querySelector('#category-description');
const categoryWarningEl = document.querySelector('#category-warning');
const skillsEl = document.querySelector('#skills');
const messageEl = document.querySelector('#message');
const searchEl = document.querySelector('#search');
const refreshEl = document.querySelector('#refresh');
const enableAllEl = document.querySelector('#enable-all');
const disableAllEl = document.querySelector('#disable-all');
const enabledCountEl = document.querySelector('#enabled-count');
const disabledCountEl = document.querySelector('#disabled-count');
const totalCountEl = document.querySelector('#total-count');

function activeCategory() {
  return state.categories.find((category) => category.id === state.activeCategory) || state.categories[0];
}

function sourceList(category = activeCategory()) {
  return category && Array.isArray(category.sources) ? category.sources : [];
}

function activeSourceId(category = activeCategory()) {
  const sources = sourceList(category);
  const selected = state.activeSources[category?.id] || 'all';
  if (selected === 'all' || sources.some((source) => source.id === selected)) {
    return selected;
  }
  return 'all';
}

function sourceQuery() {
  const selected = activeSourceId();
  if (!selected || selected === 'all') return '';
  return `?sourceId=${encodeURIComponent(selected)}`;
}

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle('error', isError);
}

function statusLabel(skill) {
  if (skill.reserved) return 'Reserved';
  return skill.enabled ? 'Enabled' : 'Disabled';
}

function updateStats() {
  const editable = state.skills.filter((skill) => !skill.reserved);
  const enabled = editable.filter((skill) => skill.enabled).length;
  const disabled = editable.length - enabled;
  enabledCountEl.textContent = String(enabled);
  disabledCountEl.textContent = String(disabled);
  totalCountEl.textContent = String(state.skills.length);
}

function renderCategories() {
  categoryTabsEl.innerHTML = '';

  for (const category of state.categories) {
    const button = document.createElement('button');
    button.className = `category-tab ${category.id === state.activeCategory ? 'active' : ''}`;
    button.type = 'button';
    button.setAttribute('aria-pressed', String(category.id === state.activeCategory));

    const label = document.createElement('strong');
    label.textContent = category.label;
    const counts = document.createElement('span');
    counts.textContent = `${category.enabled} on / ${category.disabled} off / ${category.total} total`;
    button.append(label, counts);

    button.addEventListener('click', async () => {
      if (state.activeCategory === category.id) return;
      state.activeCategory = category.id;
      state.query = '';
      searchEl.value = '';
      renderCategories();
      renderSources();
      await loadSkills();
    });

    categoryTabsEl.append(button);
  }
}

function renderSources() {
  const category = activeCategory();
  const sources = sourceList(category);
  sourceTabsEl.innerHTML = '';

  if (!category || sources.length <= 1) {
    sourceTabsEl.classList.remove('visible');
    return;
  }

  sourceTabsEl.classList.add('visible');

  const allEnabled = sources.reduce((sum, source) => sum + source.enabled, 0);
  const allDisabled = sources.reduce((sum, source) => sum + source.disabled, 0);
  const allTotal = sources.reduce((sum, source) => sum + source.total, 0);
  const tabs = [
    { id: 'all', label: 'All directories', total: allTotal, enabled: allEnabled, disabled: allDisabled },
    ...sources
  ];
  const selected = activeSourceId(category);

  for (const source of tabs) {
    const button = document.createElement('button');
    button.className = `source-tab ${source.id === selected ? 'active' : ''}`;
    button.type = 'button';
    button.setAttribute('aria-pressed', String(source.id === selected));

    const label = document.createElement('strong');
    label.textContent = source.label;
    const counts = document.createElement('span');
    counts.textContent = `${source.enabled} on / ${source.disabled} off / ${source.total} total`;
    button.append(label, counts);

    button.addEventListener('click', async () => {
      if (activeSourceId(category) === source.id) return;
      state.activeSources[category.id] = source.id;
      renderSources();
      await loadSkills({ refreshCategories: false });
    });

    sourceTabsEl.append(button);
  }
}

function renderCategoryDetails() {
  const category = activeCategory();
  if (!category) return;
  categoryTitleEl.textContent = `${category.label} skills`;
  categoryDescriptionEl.textContent = category.description || '只会影响当前分类里的可编辑 skill，受保护项会自动跳过。';
  categoryWarningEl.textContent = category.warning || '';
  categoryWarningEl.classList.toggle('visible', Boolean(category.warning));
}

function render() {
  const query = state.query.trim().toLowerCase();
  const visible = state.skills.filter((skill) => {
    return skill.name.toLowerCase().includes(query) || skill.sourceLabel.toLowerCase().includes(query);
  });
  skillsEl.innerHTML = '';
  updateStats();
  renderCategoryDetails();
  renderSources();

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = query ? '没有匹配的 skill。' : '这个分类里还没有找到可管理的 skill。';
    skillsEl.append(empty);
    return;
  }

  for (const skill of visible) {
    const row = document.createElement('article');
    row.className = 'skill-row';

    const main = document.createElement('div');
    main.className = 'skill-main';

    const nameLine = document.createElement('div');
    nameLine.className = 'name-line';

    const dot = document.createElement('span');
    dot.className = `status-dot ${skill.reserved ? 'reserved' : skill.enabled ? '' : 'disabled'}`;
    dot.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h2');
    title.className = 'name';
    title.textContent = skill.name;
    nameLine.append(dot, title);

    const pathText = document.createElement('p');
    pathText.className = 'path';
    pathText.textContent = `${skill.sourceLabel}: ${skill.path}`;
    main.append(nameLine, pathText);

    const badge = document.createElement('span');
    badge.className = `badge ${skill.reserved ? 'reserved' : skill.enabled ? '' : 'disabled'}`;
    badge.textContent = statusLabel(skill);

    const button = document.createElement('button');
    button.className = `switch ${skill.reserved ? 'reserved' : skill.enabled ? '' : 'off'}`;
    button.type = 'button';
    button.disabled = skill.reserved;
    button.setAttribute('aria-pressed', String(skill.enabled));
    button.setAttribute('aria-label', `${skill.enabled ? '关闭' : '开启'} ${skill.name}`);
    const buttonLabel = document.createElement('span');
    buttonLabel.textContent = skill.reserved ? '受保护' : skill.enabled ? '关闭' : '开启';
    button.append(buttonLabel);
    button.addEventListener('click', () => toggleSkill(skill));

    row.append(main, badge, button);
    skillsEl.append(row);
  }
}

async function loadCategories() {
  const response = await fetch('/api/categories');
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || '读取分类失败');
  }
  state.categories = body.categories;
  if (!state.categories.some((category) => category.id === state.activeCategory)) {
    state.activeCategory = state.categories[0] ? state.categories[0].id : 'personal';
  }
  const category = activeCategory();
  if (category && activeSourceId(category) !== (state.activeSources[category.id] || 'all')) {
    state.activeSources[category.id] = 'all';
  }
  renderCategories();
  renderSources();
}

async function loadSkills() {
  const category = activeCategory();
  if (!category) return;
  const selectedSourceId = activeSourceId(category);
  const source = sourceList(category).find((candidate) => candidate.id === selectedSourceId);
  const scopeName = source ? `${category.label} / ${source.label}` : category.label;
  setMessage(`正在读取 ${scopeName} skills...`);
  const response = await fetch(`/api/categories/${encodeURIComponent(state.activeCategory)}/skills${sourceQuery()}`);
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || '读取失败');
  }
  state.skills = body.skills;
  setMessage(`已读取 ${scopeName} 里的 ${state.skills.length} 个 skill。`);
  render();
}

async function refreshAll() {
  await loadCategories();
  await loadSkills();
}

async function toggleSkill(skill) {
  const nextEnabled = !skill.enabled;
  setMessage(`${nextEnabled ? '开启' : '关闭'} ${skill.name}...`);

  try {
    const response = await fetch(`/api/categories/${encodeURIComponent(state.activeCategory)}/skills/${encodeURIComponent(skill.id)}/toggle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: nextEnabled })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || '切换失败');
    }
    setMessage(`${body.skill.name} 已${body.skill.enabled ? '开启' : '关闭'}。`);
    await refreshAll();
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function setAllSkills(enabled) {
  const category = activeCategory();
  const selectedSourceId = activeSourceId(category);
  const source = sourceList(category).find((candidate) => candidate.id === selectedSourceId);
  const scopeName = source ? `${category.label} / ${source.label}` : category.label;
  setMessage(`${enabled ? '开启' : '关闭'} ${scopeName} 里的所有可编辑 skills...`);

  try {
    const response = await fetch(`/api/categories/${encodeURIComponent(state.activeCategory)}/skills/bulk`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled, sourceId: selectedSourceId === 'all' ? undefined : selectedSourceId })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || '批量切换失败');
    }
    const changed = body.result.changed.length;
    const skipped = body.result.skipped.length;
    setMessage(`${scopeName} 已${enabled ? '开启' : '关闭'} ${changed} 个 skill，跳过 ${skipped} 个。`);
    await refreshAll();
  } catch (error) {
    setMessage(error.message, true);
  }
}

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  render();
});

refreshEl.addEventListener('click', () => {
  refreshAll().catch((error) => setMessage(error.message, true));
});

enableAllEl.addEventListener('click', () => {
  setAllSkills(true);
});

disableAllEl.addEventListener('click', () => {
  setAllSkills(false);
});

refreshAll().catch((error) => setMessage(error.message, true));
