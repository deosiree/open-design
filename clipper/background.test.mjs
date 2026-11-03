import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const backgroundSource = await readFile(new URL('./background.js', import.meta.url), 'utf8');

function createBackgroundContext() {
  const context = vm.createContext({
    chrome: {
      contextMenus: {
        create() {},
        onClicked: { addListener() {} },
      },
      runtime: {
        onInstalled: { addListener() {} },
        onMessage: { addListener() {} },
      },
    },
    importScripts() {},
  });
  vm.runInContext(backgroundSource, context);
  return context;
}

test('inlineHtml does not let a shorter resource URL corrupt a longer URL', () => {
  const shortUrl = 'https://cdn.example.com/img/logo.png';
  const longUrl = `${shortUrl}?v=2`;
  const shortData = 'data:image/png;base64,c21hbGw=';
  const longData = 'data:image/png;base64,bGFyZ2U=';
  const context = createBackgroundContext();
  context.html = `<img src="${shortUrl}"><img src="${longUrl}">`;
  context.resources = new Map([
    [shortUrl, shortData],
    [longUrl, longData],
  ]);

  const result = vm.runInContext('inlineHtml(html, resources)', context);

  assert.equal(result, `<img src="${shortData}"><img src="${longData}">`);
});

test('inlineHtml leaves an unselected longer URL intact when a shorter URL is inlined', () => {
  const shortUrl = 'https://cdn.example.com/img/logo.png';
  const longUrl = `${shortUrl}?v=2`;
  const shortData = 'data:image/png;base64,c21hbGw=';
  const context = createBackgroundContext();
  context.html = `<img src="${shortUrl}"><img src="${longUrl}">`;
  context.resources = new Map([[shortUrl, shortData]]);

  const result = vm.runInContext('inlineHtml(html, resources)', context);

  assert.equal(result, `<img src="${shortData}"><img src="${longUrl}">`);
});

test('inlineHtml matches ampersands escaped in serialized HTML attributes', () => {
  const url = 'https://cdn.example.com/img.png?a=1&b=2';
  const data = 'data:image/png;base64,aW1hZ2U=';
  const context = createBackgroundContext();
  context.html = '<img src="https://cdn.example.com/img.png?a=1&amp;b=2">';
  context.resources = new Map([[url, data]]);

  const result = vm.runInContext('inlineHtml(html, resources)', context);

  assert.equal(result, `<img src="${data}">`);
});
