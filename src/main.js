import './styles.css';
import { readLanguage, setLanguage, translations } from './i18n/index.js';
import { createViewer } from './scene/renderer.js';

const $ = selector => document.querySelector(selector);
let lang = readLanguage();
document.documentElement.classList.toggle('touch-enabled', navigator.maxTouchPoints > 0);
const angleButtons = [...document.querySelectorAll('[data-angle]')];
const viewName = $('#current-view');
const zoomValue = $('#zoom-value');
function updateView(angle, percent) {
  for (const button of angleButtons) {
    button.setAttribute('aria-pressed', String(button.dataset.angle === angle));
  }
  viewName.dataset.text = angle;
  viewName.textContent = translations[lang][angle];
  zoomValue.value = new Intl.NumberFormat(lang, { style: 'percent' }).format(percent / 100);
  $('#zoom-out').disabled = percent <= 70;
  $('#zoom-in').disabled = percent >= 155;
}
function showFailure() {
  $('#failure').hidden = false;
  $('.stage-footer').hidden = true;
  for (const button of document.querySelectorAll('aside button')) button.disabled = true;
}

for (const button of document.querySelectorAll('[data-language]')) {
  button.addEventListener('click', () => {
    lang = button.dataset.language;
    setLanguage(lang, true);
  });
}
$('#retry').addEventListener('click', () => location.reload());
try {
  const viewer = createViewer($('#viewport'), updateView, showFailure);
  for (const button of angleButtons) button.addEventListener('click', () => viewer.orient(button.dataset.angle));
  $('#reset').addEventListener('click', viewer.reset);
  $('#zoom-in').addEventListener('click', () => viewer.zoom(1.15));
  $('#zoom-out').addEventListener('click', () => viewer.zoom(1 / 1.15));
} catch (error) {
  console.warn('3D viewer unavailable', error);
  showFailure();
}
setLanguage(lang, new URL(location.href).searchParams.get('lang') !== null);
