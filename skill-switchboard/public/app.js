'use strict';

const state = {
  skills: [],
  query: ''
};

const skillsEl = document.querySelector('#skills');
const messageEl = document.querySelector('#message');
const searchEl = document.querySelector('#search');
const refreshEl = document.querySelector('#refresh');
const enableAllEl = document.querySelector('#enable-all');
const disableAllEl = document.querySelector('#disable-all');
const enabledCountEl = document.querySelector('#enabled-count');
const disabledCountEl = document.querySelector('#disabled-count');
const totalCountEl = document.querySelector('#total-count');

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

function render() {
  const query = state.query.trim().toLowerCase();
  const visible = state.skills.filter((skill) => skill.name.toLowerCase().includes(query));
  skillsEl.innerHTML = '';
  updateStats();

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = query ? '没有匹配的 skill。' : '还没有找到可管理的 skill。';
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
    pathText.textContent = skill.path;
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

async function loadSkills() {
  setMessage('正在读取 skills...');
  const response = await fetch('/api/skills');
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || '读取失败');
  }
  state.skills = body.skills;
  setMessage(`已读取 ${state.skills.length} 个 skill。`);
  render();
}

async function toggleSkill(skill) {
  const nextEnabled = !skill.enabled;
  setMessage(`${nextEnabled ? '开启' : '关闭'} ${skill.name}...`);

  try {
    const response = await fetch(`/api/skills/${encodeURIComponent(skill.name)}/toggle`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: nextEnabled })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || '切换失败');
    }
    setMessage(`${body.skill.name} 已${body.skill.enabled ? '开启' : '关闭'}。`);
    await loadSkills();
  } catch (error) {
    setMessage(error.message, true);
  }
}

async function setAllSkills(enabled) {
  setMessage(`${enabled ? '开启' : '关闭'}所有可编辑 skills...`);

  try {
    const response = await fetch('/api/skills/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || '批量切换失败');
    }
    const changed = body.result.changed.length;
    const skipped = body.result.skipped.length;
    setMessage(`已${enabled ? '开启' : '关闭'} ${changed} 个 skill，跳过 ${skipped} 个。`);
    await loadSkills();
  } catch (error) {
    setMessage(error.message, true);
  }
}

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  render();
});

refreshEl.addEventListener('click', () => {
  loadSkills().catch((error) => setMessage(error.message, true));
});

enableAllEl.addEventListener('click', () => {
  setAllSkills(true);
});

disableAllEl.addEventListener('click', () => {
  setAllSkills(false);
});

loadSkills().catch((error) => setMessage(error.message, true));
