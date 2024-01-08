import d from './dominant.js';
import lf from 'https://cdn.skypack.dev/localforage';

class ActionHandler {
  constructor(designer) { this.designer = designer }
  get sidebarNode() { return this.designer.sidebarNode }
  get toolbarNode() { return this.designer.editor.toolbarNode }
  get editorWindow() { return this.designer.editorWindow }
  get editorDocument() { return this.designer.editorDocument }
  get s() { return this.designer.s }
  set s(x) { this.designer.s = x }
  
  sToggle = () => {
    let pe = this.s && this.s.closest('[contenteditable="true"]');
    if (pe) { pe.removeAttribute('contenteditable') }
    if (this.s) { this.sPrev = this.s; this.s = null }
    else { this.s = this.sPrev; this.sPrev = null }
    d.update();
  };
  
  toggleSidebar = () => { this.sidebarNode.classList.toggle('hidden') };
  toggleToolbar = () => { this.toolbarNode.classList.toggle('hidden') };
  scrollIntoView = () => { this.s && this.s.scrollIntoView() };
  scrollIntoViewBottom = () => { this.s && this.s.scrollIntoView({ block: 'end' }) };
  
  selectParent = () => this.select('parentElement');
  selectNext = () => this.select('nextElementSibling');
  selectPrev = () => this.select('previousElementSibling');
  selectFirstChild = () => this.select('firstElementChild');
  selectLastChild = () => this.select('lastElementChild');
  
  find = async (dir = 'forward') => {
    let [btn, value] = await showModal(d.el(InputDialog, {
    title: 'Find by selector', short: true,
    value: localStorage.getItem('lastFindSelector') || '',
    }));
    if (btn !== 'ok') { return }
    localStorage.setItem('lastFindSelector', value);
    this.findSelector = value;
    let found = [...this.editorDocument.querySelectorAll(value)];
    this.found = this.s = found.at(dir === 'forward' ? 0 : -1);
    this.found.scrollIntoView({ block: 'center' });
    d.update();
  };
  
  findMore = (dir = 'forward') => {
    if (!this.findSelector) { return }
    let found = [...this.editorDocument.querySelectorAll(this.findSelector)];
    let i = found.indexOf(this.found);
  
    if (i === -1) {
    this.found = found.at(dir === 'forward' ? 0 : -1);
    } else {
    this.found = found[i + (dir === 'forward' ? 1 : -1)];
    if (!this.found) {
      this.found = found.at(dir === 'forward' ? 0 : -1);
    }
    }
  
    this.found.scrollIntoView({ block: 'center' });
    this.s = this.found;
    d.update();
  };
  
  select = x => {
    let y = this.s[x];
    y && this.editorDocument.contains(y) && this.editorDocument !== y && (this.s = y);
    d.update();
  };
  
  mvUp = () => { this.mv(-1) };
  mvDown = () => { this.mv(1) };
  
  mv = i => {
    let p = this.s.parentElement, j = [...p.childNodes].indexOf(this.s), k = 1, pv;
    while (true) {
    pv = p.childNodes[j + (i * k)];
    if (!pv || (pv.nodeType !== Node.COMMENT_NODE && pv.nodeType !== Node.TEXT_NODE) || pv.textContent.trim()) { break }
    k++;
    }
    pv && p.insertBefore(this.s, i < 1 ? pv : pv.nextSibling);
  };
  
  createAfter = () => { this.create('afterend') };
  createBefore = () => { this.create('beforebegin') };
  createInsideFirst = () => { this.create('afterbegin') };
  createInsideLast = () => { this.create('beforeend') };
  
  create = pos => {
    if (this.s.classList.contains('Placeholder') && (pos === 'afterbegin' || pos === 'beforeend')) { return }
    let x = d.jsx`<div class="Placeholder">`;
    this.s.insertAdjacentElement(pos, x);
    this.s = x;
    d.update();
  };
  
  copy = async () => { await lf.setItem('copy', this.s.outerHTML) };
  
  changeClipPath = async () => {
    let [btn, value] = await showModal(d.el(InputDialog, {
    title: 'Change clip path', value: this.s.style.clipPath,
    }));
    if (btn !== 'ok') { return }
    this.s.style.setProperty('clip-path', value.trim());
  };
  
  pasteAfter = () => { this.paste('afterend') };
  pasteBefore = () => { this.paste('beforebegin') };
  pasteInsideFirst = () => { this.paste('afterbegin') };
  pasteInsideLast = () => { this.paste('beforeend') };
  
  paste = async pos => {
    if (this.s.classList.contains('Placeholder') && (pos === 'afterbegin' || pos === 'beforeend')) { return }
    let x = d.jsx`<div>`;
    x.innerHTML = await lf.getItem('copy');
    let y = x.firstElementChild;
    this.s.insertAdjacentElement(pos, y);
    this.s = y;
    d.update();
  };
  
  rm = () => {
    let { editorDocument } = this;
    let children = [...editorDocument.body.children].filter(x => x.tagName !== 'SCRIPT');
    if (children.length === 1 && this.s.parentElement === editorDocument.body) { return }
    this.copy();
    let p = this.s.parentElement, i = [...p.children].indexOf(this.s);
    this.s.remove();
    this.s = p.children[i] || p.children[i - 1] || p;
    d.update();
  };
  
  wrap = () => { this.wrapTagName('div') };
  
  wrapTagName = x => {
    let p = this.s.parentElement, i = [...p.children].indexOf(this.s);
    this.s.outerHTML = `<${x}>${this.s.outerHTML}</${x}>`;
    this.s = p.children[i];
    d.update();
  };
  
  unwrap = () => {
    let p = this.s.parentElement, i = [...p.children].indexOf(this.s);
    this.s.outerHTML = this.s.innerHTML;
    this.s = p.children[i];
    d.update();
  };
  
  changeTag = async () => {
    let tagName = this.s.tagName.toLowerCase();
    let [btn, x] = await showModal(d.el(InputDialog, {
    short: true, title: 'Change tag', value: tagName,
    }));
    if (btn !== 'ok') { return }
    if (this.s.tagName === 'DIALOG' && x !== 'dialog') { this.s.open = false }
    this.changeTagName(x);
    if (x === 'dialog') { this.s.open = false; this.s.showModal() }
  };
  
  changeTagName = x => {
    let tagName = this.s.tagName.toLowerCase();
    let p = this.s.parentElement, i = [...p.children].indexOf(this.s);
    if (x === 'img' || x === 'video' || x === 'br' || x === 'hr') { this.s.innerHTML = '' }
    this.s.outerHTML = this.s.outerHTML.replace(tagName, x);
    this.s = p.children[i];
    d.update();
  };
  
  changeText = async () => {
    let [btn, x] = await showModal(d.el(InputDialog, {
    title: 'Change text', value: this.s.textContent,
    }));
    if (btn !== 'ok') { return }
    this.s.textContent = x;
  };
  
  changeMultilineText = async () => {
    let [btn, x] = await showModal(d.el(InputDialog, {
    title: 'Change multiline text', multiline: true,
    value: this.s.textContent,
    }));
    if (btn !== 'ok') { return }
    this.s.textContent = x;
  };
  
  changeHref = async () => {
    let [btn, x] = await showModal(d.el(InputDialog, {
    short: true, title: 'Change href', value: this.s.getAttribute('href'),
    }));
    if (btn !== 'ok') { return }
    if (this.s.tagName === 'DIV' || this.s.tagName === 'SPAN') { this.changeTagName('a') }
    else if (this.s.tagName !== 'A') { this.wrapTagName('a') }
    if (x) { this.s.href = x } else { this.s.removeAttribute('href') }
  };
  
  changeSrcUrl = async () => {
    let [btn, x] = await showModal(d.el(InputDialog, {
    short: true, title: 'Change src', value: this.s.src,
    }));
    if (btn !== 'ok') { return }
    this.s.classList.toggle('Placeholder', false);
    this.s.tagName !== 'VIDEO' && this.s.tagName !== 'IFRAME' && this.changeTagName('img');
    if (x) { this.s.src = x } else { this.s.removeAttribute('src') }
  };
  
  changeBgUrl = async () => {
    let current = this.s.style.backgroundImage;
    let [btn, x] = await showModal(d.el(InputDialog, {
    short: true, title: 'Change background image',
    value: current.startsWith('url("') ? current.slice(5, -2) : current,
    }));
    if (btn !== 'ok') { return }
    this.s.classList.toggle('Placeholder', false);
    if (x) { this.s.style.backgroundImage = `url(${JSON.stringify(x)})` }
    else { this.s.style.backgroundImage = '' }
  };
  
  changeSrcUpload = async () => {
    let f = await selectFile();
    let [btn, x] = await showModal(d.el(UploadDialog, { file: f }));
    if (btn !== 'ok') { return }
    this.s.classList.toggle('Placeholder', false);
    this.s.tagName !== 'VIDEO' && this.changeTagName('img');
    this.s.src = x;
  };
  
  changeBgUpload = async () => {
    let f = await selectFile();
    let [btn, x] = await showModal(d.el(UploadDialog, { file: f }));
    if (btn !== 'ok') { return }
    this.s.classList.toggle('Placeholder', false);
    this.s.style.backgroundImage = tap(`url(${JSON.stringify(x)})`);
  };
  
  changeHtml = async () => {
    let [btn, x] = await showModal(d.el(CodeDialog, {
    title: 'Change HTML', value: this.s.outerHTML,
    }));
    if (btn !== 'ok') { return }
    let p = this.s.parentElement, i = [...p.children].indexOf(this.s);
    this.s.outerHTML = x;
    this.s = p.children[i];
    d.update();
  };
  
  changeInnerHtml = async () => {
    let [btn, x] = await showModal(d.el(CodeDialog, {
    title: 'Change inner HTML', value: this.s.innerHTML,
    }));
    if (btn !== 'ok') { return }
    this.s.innerHTML = x;
  };
  
  gptPrompt = async () => {
    let [btn, value] = await showModal(d.el(InputDialog, {
    title: 'Add a ChatGPT prompt as HTML', multiline: true,
    }));
    if (btn !== 'ok') { return }
    let t = this.s;
    t.classList.remove('Placeholder');
    t.textContent = 'Please wait while OpenAI works its magic...';
    let res = await req.post('/v1/gpt', {
    body: { prompt: `Generate only HTML with no explanations. Using Tailwind CSS, ${value}` },
    });
    let html = new DOMParser().parseFromString(res.result, 'text/html');
    t.innerHTML = html.body.innerHTML;
  };
  
  toggleDialog = () => {
    if (this.s.tagName !== 'DIALOG') { return }
    if (this.s.open) { this.s.close() } else { this.s.showModal() }
  };
  
  toggleEditable = ev => {
    let pe = this.s.closest('[contenteditable="true"]');
    if (!pe || pe === this.s) {
    let t = pe || this.s;
    if ([...this.s.querySelectorAll('*')].every(x => x.matches('span, button, input, ul, ol, li, br'))) { t = t.parentElement }
    if (!JSON.parse(pe?.contentEditable || false)) { t.contentEditable = true }
    else { t.removeAttribute('contenteditable') }
    ev && ev.preventDefault();
    }
  };
  
  shiftHidden = i => {
    let p = this.s.parentElement, c = this.s;
    while (p) {
    if ([...p.children].some(x => x.classList.contains('hidden'))) { break }
    p = p.parentElement;
    c = c.parentElement;
    }
    if (!p) { return }
    let siblings = [...p.children];
    let j = siblings.indexOf(c) + i;
    if (j < 0) { j = siblings.length - 1 }
    else if (j > siblings.length - 1) { j = 0 }
    for (let x of siblings) { x.classList.add('hidden') }
    siblings[j].classList.remove('hidden');
    this.s = siblings[j];
    d.update();
  };
  
  shiftHiddenLeft = () => this.shiftHidden(-1);
  shiftHiddenRight = () => this.shiftHidden(1);
  
  toggleStylesTab = () => {
    let { activeTabKey } = this.designer.sidebar;
    if (activeTabKey !== 'styles' || this.sidebarNode.classList.contains('hidden')) {
    this.sidebarNode.classList.remove('hidden');
    this.designer.sidebar.activeTabKey = 'styles';
    } else {
    this.sidebarNode.classList.add('hidden');
    }
    d.update();
  };
  
  toggleActionsTab = () => {
    let { activeTabKey } = this.designer.sidebar;
    if (activeTabKey !== 'actions' || this.sidebarNode.classList.contains('hidden')) {
    this.sidebarNode.classList.remove('hidden');
    this.designer.sidebar.activeTabKey = 'actions';
    } else {
    this.sidebarNode.classList.add('hidden');
    }
    d.update();
  };
  
  kbds = {
    Escape: this.sToggle,
    '.': this.toggleSidebar,
    ',': this.toggleToolbar,
    ';': this.scrollIntoView,
    ':': this.scrollIntoViewBottom,
    h: this.selectParent,
    j: this.selectNext,
    J: this.mvDown,
    k: this.selectPrev,
    K: this.mvUp,
    l: this.selectFirstChild,
    L: this.selectLastChild,
    f: () => this.find('forward'),
    F: () => this.find('backward'),
    n: () => this.findMore('forward'),
    N: () => this.findMore('backward'),
    a: this.createAfter,
    A: this.createBefore,
    i: this.createInsideLast,
    I: this.createInsideFirst,
    d: this.rm,
    c: this.copy,
    C: this.changeClipPath,
    p: this.pasteAfter,
    P: this.pasteBefore,
    o: this.pasteInsideLast,
    O: this.pasteInsideFirst,
    w: this.wrap,
    W: this.unwrap,
    e: this.changeTag,
    t: this.changeText,
    T: this.changeMultilineText,
    H: this.changeHref,
    s: this.changeSrcUrl,
    b: this.changeBgUrl,
    S: this.changeSrcUpload,
    B: this.changeBgUpload,
    m: this.changeHtml,
    M: this.changeInnerHtml,
    G: this.gptPrompt,
    x: this.toggleDialog,
    v: this.toggleEditable,
    '<': this.shiftHiddenLeft,
    '>': this.shiftHiddenRight,
  };
}

export default ActionHandler;