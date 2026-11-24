import './styles.css';
import { readLanguage, setLanguage, translations } from './i18n/index.js';
import { createViewer } from './scene/renderer.js';
import { structures, stageIds } from './data/structures.js';
import { organs, internal } from './geometry/layers.js';
import { references } from './data/references.js';
import human from './species/human.js';
import dog from './species/dog.js';

const $ = (selector) => document.querySelector(selector);
const species = { human, dog };
const url = new URL(location.href);
if (url.searchParams.has('style')) {
  url.searchParams.delete('style');
  history.replaceState(null, '', url);
}
let lang = readLanguage();
let id = url.searchParams.get('species') === 'dog' ? 'dog' : 'human';
const sharedStage = stageIds.indexOf(url.searchParams.get('layer'));
let stage = sharedStage < 0 ? 8 : sharedStage;
let selected = stage === 9 ? 'lobule' : stageIds[stage];
let viewer,
  revision = 0;
document.documentElement.classList.toggle('touch-enabled', navigator.maxTouchPoints > 0);
const angleButtons = [...document.querySelectorAll('[data-angle]')];
const speciesButtons = [...document.querySelectorAll('[data-species]')];

function updateURL(key, value) {
  const here = new URL(location.href);
  here.searchParams.set(key, value);
  history.replaceState(null, '', here);
}
function updateView(angle, percent) {
  for (const button of angleButtons)
    button.setAttribute('aria-pressed', String(button.dataset.angle === angle));
  $('#current-view').dataset.text = angle;
  $('#current-view').textContent = translations[lang][angle];
  $('#zoom-value').value = new Intl.NumberFormat(lang, { style: 'percent' }).format(percent / 100);
  $('#zoom-out').disabled = percent <= 70;
  $('#zoom-in').disabled = percent >= 155;
}
function option(value, label) {
  return new Option(label, value);
}
function stageLabel(index) {
  if (index === 8) return translations[lang].core;
  if (index === 9) return translations[lang].internal;
  return structures[stageIds[index]].name[lang];
}
function inspectable() {
  if (stage === 9) return internal;
  const items = stageIds.slice(stage, 9).concat(organs);
  if (stage <= 1) items.push('scrotal_septum');
  return items;
}
function showCard() {
  $('#structure').value = selected;
  $('#detail').textContent = structures[selected].simple[lang];
  const book = id === 'dog' ? 'dyce' : 'grays';
  $('#structure-source').href = references[book].url;
}
function updateText() {
  const t = translations[lang];
  $('#layer').replaceChildren(...stageIds.map((key, i) => option(key, stageLabel(i))));
  $('#layer').value = stageIds[stage];
  $('#peel').value = stage;
  $('#peel').setAttribute('aria-valuetext', stageLabel(stage));
  $('#structure').replaceChildren(...inspectable().map((key) => option(key, structures[key].name[lang])));
  $('#specimen-title').textContent = t[id] + ' · ' + stageLabel(stage);
  $('#specimen-note').textContent = t[id + 'Note'];
  $('#references').replaceChildren(
    ...species[id].refs.map((key) => {
      const link = document.createElement('a');
      link.href = references[key].url;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.textContent = references[key][lang];
      return link;
    }),
  );
  for (const button of speciesButtons)
    button.setAttribute('aria-pressed', String(button.dataset.species === id));
  showCard();
}
function chooseStage(index, persist = true) {
  stage = index;
  selected = stage === 9 ? 'lobule' : stageIds[stage];
  viewer?.setStage(stage);
  viewer?.highlight(null);
  updateText();
  if (persist) updateURL('layer', stageIds[stage]);
}
function pick(key) {
  if (!inspectable().includes(key)) return;
  // Reveal a keyboard-selected structure that is still covered by superficial layers.
  const shell = stageIds.indexOf(key);
  if (shell > stage) chooseStage(shell);
  else if (organs.includes(key) && stage < 8) chooseStage(8);
  else if (key === 'scrotal_septum' && stage === 0) chooseStage(1);
  selected = key;
  viewer?.highlight(key);
  showCard();
}
function showFailure(reason = 'unavailable') {
  $('#failure p').dataset.text = reason;
  $('#failure p').textContent = translations[lang][reason];
  $('#failure').hidden = false;
  $('#loading').hidden = true;
  $('.stage-footer').hidden = true;
  $('#viewport').setAttribute('aria-busy', 'false');
  for (const control of document.querySelectorAll('aside button,aside select,aside input'))
    control.disabled = true;
}
async function loadSpecimen() {
  const ticket = ++revision;
  $('#loading').hidden = false;
  $('#failure').hidden = true;
  $('#viewport').setAttribute('aria-busy', 'true');
  try {
    if (!(await viewer.setSpecies(id)) || ticket !== revision) return;
    $('#loading').hidden = true;
    $('.stage-footer').hidden = false;
    $('#viewport').setAttribute('aria-busy', 'false');
    for (const control of document.querySelectorAll('aside button,aside select,aside input')) {
      if (!control.id.startsWith('zoom-')) control.disabled = false;
    }
  } catch (error) {
    if (ticket === revision) showFailure('modelFailed');
    console.warn('Specimen unavailable', error);
  }
}
for (const button of document.querySelectorAll('[data-language]'))
  button.addEventListener('click', () => {
    lang = button.dataset.language;
    setLanguage(lang, true);
    updateText();
  });
for (const button of speciesButtons)
  button.addEventListener('click', () => {
    if (id === button.dataset.species) return;
    id = button.dataset.species;
    updateURL('species', id);
    updateText();
    if (viewer) loadSpecimen();
  });
$('#retry').addEventListener('click', () => location.reload());
$('#layer').addEventListener('change', (e) => chooseStage(stageIds.indexOf(e.target.value)));
$('#peel').addEventListener('input', (e) => chooseStage(Number(e.target.value)));
$('#structure').addEventListener('change', (e) => pick(e.target.value));
try {
  viewer = createViewer($('#viewport'), updateView, () => showFailure(), pick);
  for (const button of angleButtons)
    button.addEventListener('click', () => viewer.orient(button.dataset.angle));
  $('#reset').addEventListener('click', viewer.reset);
  $('#zoom-in').addEventListener('click', () => viewer.zoom(1.15));
  $('#zoom-out').addEventListener('click', () => viewer.zoom(1 / 1.15));
  viewer.setStage(stage);
  loadSpecimen();
} catch (error) {
  console.warn('3D viewer unavailable', error);
  showFailure();
}
setLanguage(lang, url.searchParams.has('lang'));
updateText();
