import ActionHandler from './ActionHandler.js';
import JSZip from 'https://cdn.skypack.dev/jszip';
import MagicGloves from './MagicGloves.js';
import d from './dominant.js';
import lf from 'https://cdn.skypack.dev/localforage';
import structuredFiles from './structuredFiles.js';
import { nanoid } from 'https://cdn.skypack.dev/nanoid';
import { showModal } from './util.js';
window.lf = lf;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { type: 'module' }).then(function(registration) {
    console.log('ServiceWorker registration successful with scope: ', registration.scope);
  }).catch(function(error) {
    console.log('ServiceWorker registration failed: ', error);
  });
}

class App {
  constructor() {
    window.app = this;
    this.actions = new ActionHandler(this);
    this.loadSites();
  }

  get editorWindow() { return this.content.contentWindow }
  get editorDocument() { return this.content.contentDocument }
  get s() { return this.gloves?.s }
  set s(x) { this.gloves.s = x }

  render = () => d.jsx`
    <div class="w-80 h-screen shrink-0 flex flex-col bg-[#2b2d31] text-[#949ba4] shadow-2xl">
      <div class="border-b border-[#1f2124] px-5 py-3">
        <div class="gfont-[Pacifico] text-gray-100">Webfoundry</div>
      </div>
      <div class="flex gap-3 justify-around border-b border-[#1f2124] p-3 text-sm">
        ${this.menuBtn('Sites', 'sites')}
        ${this.menuBtn('Files', 'files')}
        ${this.menuBtn('Styles', 'styles')}
      </div>
      ${d.portal(() => this.sidebar)}
    </div>
    ${d.portal(() => this.content)}
  `;

  menuBtn = (label, key) => d.jsx`
    <button ${{
      class: () => this.activeSidebar === key && 'text-gray-100 underline',
      onClick: () => this.activeSidebar = key,
    }}>
      ${label}
    </button>
  `;

  sidebars = { sites: d.el(SitesSidebar), files: d.el(FilesSidebar), styles: d.el(StylesSidebar) };
  activeSidebar = 'sites';
  get sidebar() { return this.sidebars[this.activeSidebar] }

  sites = {};
  files = [];

  loadSites = () => {
    this.sites = {};
    for (let k of Object.keys(localStorage).filter(k => k.startsWith('site:'))) {
      this.sites[k.slice('site:'.length)] = localStorage.getItem(k);
    }
    d.update();
  };

  openSite = async x => {
    this.currentSite = x;
    this.activeSidebar = 'files';
    await this.loadFiles();
    d.update();
  };

  loadFiles = async () => {
    this.files = [];
    d.update();
    let keys = await lf.keys();
    let prefix = `file:${this.currentSite}:`;
    let files = keys.filter(x => x.startsWith(prefix)).map(x => x.slice(prefix.length));
    this.files = structuredFiles(files);
    d.update();
  };
}

class SitesSidebar {
  onNewSiteKeyDown = ev => {
    if (ev.key !== 'Enter') { return }
    let name = ev.target.value.trim();
    if (!name) { return }
    ev.target.value = '';
    localStorage.setItem(`site:${nanoid()}`, name);
    app.loadSites();
  };

  render = () => d.jsx`
    <div class="flex-1 overflow-auto">
        <div class="flex flex-col gap-1 p-3 text-sm">
            ${d.map(() => Object.keys(app.sites), x => d.jsx`
                <a class="flex gap-2 justify-between items-center rounded px-3 py-1" href="#" ${{ onClick: () => app.openSite(x) }}>
                    <div class="flex gap-2 items-center">
                        <i class="nf nf-fa-sitemap"></i>
                        <span>${d.text(() => app.sites[x])}</span>
                    </div>
                    <div class="relative top-[-1px] flex gap-2">
                        <button class="nf nf-fa-pencil"></button>
                        <button class="nf nf-fa-trash"></button>
                    </div>
                </a>
            `)}
            <div class="flex gap-2 justify-between items-center rounded px-3 py-1">
                <div class="flex gap-2 items-center">
                    <i class="nf nf-fa-plus"></i>
                    <input class="outline-none bg-transparent" placeholder="new site" ${{ onKeyDown: this.onNewSiteKeyDown }}>
                </div>
            </div>
        </div>
    </div>
  `;
}

class FilesSidebar {
  constructor() { window.filesSidebar = this }
  expandedPaths = new Set();

  newFile = async path => {
    let [btn, detail] = await showModal(d.el(NewDialog));
    if (btn !== 'ok') { return }
    let [type, name] = detail;
    let prefix = `file:${app.currentSite}:`;
    if (path) { prefix += `${path}/`; this.expandedPaths.add(`${path}/`) }
    switch (type) {
      case 'file': await lf.setItem(`${prefix}${name}`, ''); break;
      case 'folder': await lf.setItem(`${prefix}${name}/.keep`, ''); break;
    }
    await app.loadFiles();
  };

  openFile = async path => {
    app.gloves?.destroy?.();
    let isHtml = path.endsWith('.html');
    if (isHtml) {
      app.content = d.jsx`<iframe class="flex-1">`;
      app.content.onload = () => app.gloves = new MagicGloves(app.content, app.actions);
      app.content.src = `files/${app.currentSite}/${path}`;
    } else if (path.endsWith('.jpg') || path.endsWith('.jpeg') || path.endsWith('.png')) {
      app.content = d.jsx`<div class="flex-1 flex justify-center items-center p-16 bg-[#25272a]">`;
      let img = d.jsx`<img class="shadow-xl">`;
      img.style.maxWidth = img.style.maxHeight = 'calc(100vh - 8rem)';
      img.src = `files/${app.currentSite}/${path}`;
      app.content.append(img);
    } else {
      app.content = d.jsx`<div class="flex-1">`;
      let editor = ace.edit(app.content);
      editor.setTheme('ace/theme/monokai');
      editor.setFontSize('16px');
      let mode = path.endsWith('.js') ? 'javascript' : path.endsWith('.css') ? 'css' : null;
      mode && editor.session.setMode(`ace/mode/${mode}`);
      let reader = new FileReader();
      reader.onload = () => editor.session.setValue(reader.result);
      reader.readAsText(await lf.getItem(`file:${app.currentSite}:${path}`), 'utf-8');
    }
  };

  expandedPath(path) {
    if (!path) { return true }
    let paths = [];
    let currentPath = '';
    for (let part of path.split('/').slice(0, -1)) {
      currentPath += `${part}/`;
      paths.push(currentPath);
    }
    return paths.every(x => this.expandedPaths.has(x));
  }

  togglePath(path) {
    if (this.expandedPaths.has(path)) { this.expandedPaths.delete(path) } else { this.expandedPaths.add(path) }
  }

  renameFile = async (path, isDir) => {
    let [btn, detail] = await showModal(d.el(RenameDialog, { name: path.split('/').pop() }));
    if (btn !== 'ok') { return }
    let prefix = `file:${app.currentSite}:`;
    let newPath = path.split('/').slice(0, -1).join('/');
    if (newPath) { newPath += '/' }
    newPath += detail;
    if (!isDir) {
      await lf.setItem(`${prefix}${newPath}`, await lf.getItem(`${prefix}${path}`));
      await lf.removeItem(`${prefix}${path}`);
    } else {
      let keys = (await lf.keys()).filter(x => x.startsWith(`${prefix}${path}/`));
      await Promise.all(keys.map(async x => await lf.setItem(`${prefix}${x.slice(prefix.length).replace(path, newPath)}`, await lf.getItem(x))));
      await Promise.all(keys.map(x => lf.removeItem(x)));
    }
    await app.loadFiles();
  };

  rmFile = async (path, isDir) => {
    let prefix = `file:${app.currentSite}:${path}`;
    if (!isDir) { await lf.removeItem(prefix); await app.loadFiles(); return }
    let keys = (await lf.keys()).filter(x => x.startsWith(`${prefix}/`));
    await Promise.all(keys.map(x => lf.removeItem(x)));
    await app.loadFiles();
  };

  importZip = async () => {
    let input = document.createElement('input');
    input.style.display = 'hidden';
    input.type = 'file';
    input.accept = '.zip';

    input.onchange = async ev => {
      input.remove();
      let file = ev.target.files[0];
      if (!file) { return }
      let zip = await JSZip.loadAsync(file);
      for (let [path, entry] of Object.entries(zip.files)) {
        if (path.endsWith('/')) { continue }
        let blob = await entry.async('blob');
        await lf.setItem(`file:${app.currentSite}:${path}`, blob);
      }
      await app.loadFiles();
    };

    input.click();
  };

  render = () => d.jsx`
    <div class="flex-1 overflow-auto">
        <div class="flex flex-col gap-1 p-3 text-sm">
            <div class="flex gap-2 justify-between items-center rounded px-3 py-1">
                <div class="flex gap-2 items-center">
                    <i class="nf nf-fa-sitemap"></i>
                    ${d.text(() => app.sites[app.currentSite])}
                </div>
                <div class="relative top-[-1px] flex gap-2">
                    <button class="nf nf-fa-plus" ${{ onClick: () => this.newFile() }}></button>
                </div>
            </div>
            ${d.map(() => app.files, ([name, path, isDir]) => d.jsx`
                <a href="#" ${{
                    class: [
                      'flex gap-2 justify-between items-center rounded px-3 py-1',
                      () => `ml-${(path.split('/').length - 1) * 3}`,
                      () => !this.expandedPath(path) && 'hidden',
                    ],
                    onClick: ev => {
                      if (ev.target.tagName === 'BUTTON') { return }
                      !isDir ? this.openFile(path ? `${path}${name}` : name) : this.togglePath(path ? `${path}${name}/` : `${name}/`)
                    },
                }}>
                    <div class="flex gap-2 items-center">
                        <i ${{ class: ['nf', () => `nf-fa-${isDir ? 'folder' : 'file'}`] }}></i>
                        <span>${name}</span>
                    </div>
                    <div class="relative top-[-1px] flex gap-2">
                        ${isDir && d.jsx`<button class="nf nf-fa-plus" ${{ onClick: () => this.newFile(path ? `${path}${name}` : name) }}></button>`}
                        <button class="nf nf-fa-pencil" ${{ onClick: () => this.renameFile(path ? `${path}${name}` : name, isDir) }}></button>
                        <button class="nf nf-fa-trash" ${{ onClick: () => this.rmFile(path ? `${path}${name}` : name, isDir) }}></button>
                    </div>
                </a>
            `)}
            <button class="rounded px-3 py-1 border border-[#949ba4]" ${{ onClick: this.importZip }}>Import ZIP</button>
        </div>
    </div>
  `;
}

class NewDialog {
  render = () => this.root = d.jsx`
    <dialog class="p-0 bg-[#262626] rounded text-white text-sm shadow-xl">
        <div class="border-b border-neutral-900">
            <div class="px-3 py-2 flex items-center gap-3">
                New:
                ${this.typeSelect = d.jsx`
                  <select class="bg-transparent">
                      <option value="file" selected="">File</option>
                      <option value="folder">Folder</option>
                  </select>
                `}
            </div>
        </div>
        <div class="p-3">
            <div class="flex gap-3 items-center">
                Name: ${this.nameInput = d.jsx`<input class="w-full bg-[#2b2d31] rounded px-2 py-1 outline-none">`}
            </div>
        </div>
        <div class="border-neutral-900 border-t px-3 py-2 flex gap-2">
            <button class="px-3 py-1 bg-[#2b2d31] rounded flex-1" ${{ onClick: () => this.root.close('cancel') }}>Cancel</button>
            <button class="px-3 py-1 rounded flex-1 bg-[#4f46e5]" ${{ onClick: this.ok }}>OK</button>
        </div>
    </dialog>
  `;

  ok = () => {
    this.root.returnValue2 = [this.typeSelect.value, this.nameInput.value];
    this.root.close('ok');
  };
}

class RenameDialog {
  constructor(props) { this.props = props }
  get name() { return this.props.name }

  render = () => this.root = d.jsx`
    <dialog class="p-0 bg-[#262626] rounded text-white text-sm shadow-xl">
        <div class="border-b border-neutral-900">
            <div class="px-3 py-2 flex items-center gap-3">Rename</div>
        </div>
        <div class="p-3">
            <div class="flex gap-3 items-center">
                ${this.nameInput = d.jsx`<input class="w-full bg-[#2b2d31] rounded px-2 py-1 outline-none" ${{ value: this.name }}>`}
            </div>
        </div>
        <div class="border-neutral-900 border-t px-3 py-2 flex gap-2">
            <button class="px-3 py-1 bg-[#2b2d31] rounded flex-1" ${{ onClick: () => this.root.close('cancel') }}>Cancel</button>
            <button class="px-3 py-1 rounded flex-1 bg-[#4f46e5]" ${{ onClick: this.ok }}>OK</button>
        </div>
    </dialog>
  `;

  ok = () => {
    this.root.returnValue2 = this.nameInput.value;
    this.root.close('ok');
  };
}

class StylesSidebar {
  constructor() { window.stylesSidebar = this }
  get styles() { return app.s ? [...app.s.classList] : [] };
  rm(x) { app.s.classList.remove(x) }

  onKeyDown = ev => {
    if (ev.key !== 'Enter') { return }
    let value = ev.target.value.trim();
    if (!value) { return }
    app.s.classList.add(value);
    ev.target.value = '';
  };

  render = () => d.jsx`
    <div class="flex-1">
        <div class="flex flex-col gap-1 p-3 text-sm">
            ${d.map(() => this.styles, x => d.jsx`
                <a class="flex gap-2 justify-between items-center rounded px-3 py-1" href="#">
                    <div class="flex gap-2 items-center">
                        <i class="nf nf-fa-paint_brush"></i>
                        <span>${x}</span>
                    </div>
                    <div class="relative top-[-1px] flex gap-2">
                        <button class="nf nf-fa-trash" ${{ onClick: () => this.rm(x) }}></button>
                    </div>
                </a>
            `)}
            ${d.if(() => app.s, d.jsx`
              <div class="flex gap-2 justify-between items-center rounded px-3 py-1">
                  <div class="flex gap-2 items-center">
                      <i class="nf nf-fa-plus"></i>
                      <input class="outline-none bg-transparent" placeholder="add class" ${{ onKeyDown: this.onKeyDown }}>
                  </div>
              </div>
            `)}
        </div>
    </div>
  `;
}

export default App;
