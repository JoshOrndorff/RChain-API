// ISSUE: squatting on `export:`

/* global require, exports */
// @flow

const { Writer } = require('protobufjs');

const { RHOCore, b2h } = require('..');

const { link } = require('./assets');

const LOADER_TEMPLATE = link('./loader.rho');

const defaultPayment = { from: '0x1', nonce: 0, phloPrice: 1, phloLimit: 100000 };

/*::
import type { IRNode } from '..';

interface LoadAccess {
  rnode: IRNode,
  clock: () => Date,
}

 */

exports.loadRhoModule = loadRhoModule;
async function loadRhoModule(
  source /*: string*/, user /*: string*/,
  { rnode, clock } /*: LoadAccess */,
) {
  const { term, name, title } = parseModule(source, mh.name);
  const timestamp = clock().valueOf();
  const [return_] = await rnode.previewPrivateChannels({ user, timestamp }, 1);
  console.log(`Loading: ${mh.title}\n return channel: ${prettyPrivate(return_)}`);
  const loaded = await rnode.doDeploy({ user, term, timestamp, ...defaultPayment }, true);
  console.log({ loaded, name: mh.name });
  const found = await rnode.listenForDataAtName(return_);
  const moduleURI = firstBlockData(found);
  console.log(`${mh.name} registered at: ${moduleURI}`);
  return moduleURI;
}


function parseModule(sourceCode) {
  const { name, title } = moduleHeader(sourceCode);

  const topParts = sourceCode.match(/^([^{]*{)([\s\S]*)/);
  if (!topParts) { throw new Error('bad module syntax: no {'); }
  const [_, modtop, rest] = topParts;

  const exportParts = modtop.match(/(\b\w+\b)\s*\(`export:`\)/);
  if (!exportParts) { throw new Error('bad module syntax: no export:' + modtop); }
  const [_2, exportVar] = exportParts;
  const top = modtop.replace('(`export:`)', '');

  const bodyEnd = rest.lastIndexOf('}');
  if (!bodyEnd) { throw new Error('bad module syntax: no ending }'); }
  const body = rest.slice(0, bodyEnd);

  const term = LOADER_TEMPLATE
        .replace('__TOP__', top)
        .replace('__EXPORT__', exportVar)
        .replace('__NAME__', name)
        .replace('__BODY__', body);
  return { term, name, title };
}


function moduleHeader(sourceCode) {
  const parts = sourceCode.match(/...\n...((\S+).*)/);
  if (!parts) { throw new Error('cannot find title in source code'); }
  const [_, title, name] = parts;
  return { title, name };
}


/**
 * Get printable form of unforgeable name, given id.
 */
exports.unforgeableWithId = unforgeableWithId;
function unforgeableWithId(id /*: Uint8Array */) {
  const bytes = Writer.create().bytes(id).finish().slice(1);
  return `Unforgeable(0x${b2h(bytes)})`;
}

exports.prettyPrivate = prettyPrivate;
function prettyPrivate(par /*: IPar */) {
  if (!(par.ids && par.ids.length && par.ids[0].id)) { throw new Error('expected GPrivate'); }
  return unforgeableWithId(par.ids[0].id);
}

function firstBlockData(blockResults) {
  return RHOCore.toJSData(firstBlockProcess(blockResults));
}


// Get the first piece of data from listenForDataAtName
function firstBlockProcess(blockResults) {
  // console.log('found:', JSON.stringify(blockResults, null, 2));
  const ea = [].concat(...blockResults.map(br => br.postBlockData));
  // console.log('ea: ', JSON.stringify(ea, null, 2));
  const good = ea.filter(it => it.exprs.length > 0 || it.bundles.length > 0 || it.ids.length > 0);
  // console.log('good:');
  // console.log(JSON.stringify(good, null, 2));
  return good[0];
}


function integrationTest(argv, {readFileSync}) {
  const sourceFileName = argv[2];
  const src = readFileSync(sourceFileName, 'utf8');
  const mod = parseModule(src);
  console.log({ name: mod.name, title: mod.title });
  console.log(mod.term);
}


/*global module */
if (require.main === module) {
  /* global process */
  /* eslint-disable global-require */
  integrationTest(process.argv, {
    readFileSync: require('fs').readFileSync
  });
}
