'use strict';

const state = {
  skills: [],
  query: ''
};

const skillsEl = document.querySelector('#skills');
const messageEl = document.querySelector('#message');
const searchEl = document.querySelector('#search');
const refreshEl = document.querySelector('#refresh');

function setMessage(text, isError = false) {
  messageEl.textContent = text;
  messageEl.classList.toggle('error', isError);
}

function statusLabel(skill) {
  if (skill.reserved) return 'Reserved';
  return skill.enabled ? 'Enabled' : 'Disabled';
}

function render() {
  const query = state.query.trim().toLowerCase();
  const visible = state.skills.filter((skill) => skill.name.toLowerCase().includes(query));
  skillsEl.innerHTML = '';

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = query ? '没有匹配的 skill。' : '还没有找到可管理的 skill。';
    skillsEl.append(empty);
    return;
  }

  for (const skill of visible) {
    const card = document.createElement('article');
    card.className = 'card';

    const header = document.createElement('header');
    const titleWrap = document.createElement('div');
    const title = document.createElement('h2');
    title.className = 'name';
    title.textContent = skill.name;
    const pathText = document.createElement('p');
    pathText.className = 'path';
    pathText.textContent = skill.path;
    titleWrap.append(title, pathText);

    const badge = document.createElement('span');
    badge.className = `badge ${skill.reserved ? 'reserved' : skill.enabled ? '' : 'disabled'}`;
    badge.textContent = statusLabel(skill);
    header.append(titleWrap, badge);

    const button = document.createElement('button');
    button.className = `switch ${skill.enabled ? '' : 'off'}`;
    button.type = 'button';
    button.disabled = skill.reserved;
    button.textContent = skill.reserved ? '受保护' : skill.enabled ? '关闭' : '开启';
    button.addEventListener('click', () => toggleSkill(skill));

    card.append(header, button);
    skillsEl.append(card);
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

searchEl.addEventListener('input', () => {
  state.query = searchEl.value;
  render();
});

refreshEl.addEventListener('click', () => {
  loadSkills().catch((error) => setMessage(error.message, true));
});

loadSkills().catch((error) => setMessage(error.message, true));
