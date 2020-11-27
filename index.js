#!/usr/bin/env node

const readline = require('readline');
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const {
  env: { DEBUG, TERM },
  argv: [, , folder, suiteFilter, testFilter],
  exit
} = process;

const getPathValue = obj => key => key.split('.').reduce(
  (obj, key) => obj[parseInt(key) == key ? parseInt(key) : key],
  obj
);

const getAttr = (ctx, attr) => typeof attr === 'function' ? attr(ctx) : attr;

const runTest = (ctx, {
  name = 'no name',
  type, attempt = 0,
  params = {}, expected = {},
  addToCtx = () => ({})
}) => Promise.resolve(`- ${name}`)
  .then(title => { if (attempt === 0) { process.stdout.write(title); } })
  .then(() => new Promise(resolve => setTimeout(() => resolve(null), 1000 * attempt)))
  .then(() => typeof type === 'function' ? type : require(`./modules/${type}.js`))
  .then(testModule => {
    const start = new Date().valueOf();
    return testModule(getAttr(ctx, params))
      .then(actual => {
        const end = new Date().valueOf();
        const exp = getAttr(ctx, expected);
        if (DEBUG) {
          process.stdout.write("\n");
          console.log('request');
          console.log(JSON.stringify(getAttr(ctx, params), null, 2));
          console.log('response');
          console.log(JSON.stringify(actual, null, 2));
        }
        Object.keys(exp).forEach(key => {
          if (exp[key] instanceof RegExp) {
            assert.match(
              getPathValue(actual)(key),
              exp[key],
              `"${key}" does not match "${exp[key]}", it is set to "${getPathValue(actual)(key)}"`
            );
          } else {
            assert.strictEqual(
              getPathValue(actual)(key),
              exp[key],
              `"${key}" is not "${exp[key]}", but "${getPathValue(actual)(key)}"`
            );
          }
        });

        return { response: actual, time: end - start };
      });
  })
  .then(({ response, time }) => {
    process.stdout.write(`: ${time}ms`);
    if (TERM === 'xterm-256color') {
      readline.cursorTo(process.stdout, 0, null);
    } else {
      process.stdout.write(' ');
    }
    process.stdout.write("✓\n");
    return { rc: 0, ctx: { ...ctx, ...addToCtx(response) } };
  })
  .catch(error => {
    if (getAttr(ctx, params).method === 'GET' && attempt < 10) {
      return runTest(ctx, { name, type, attempt: attempt+1, params, expected, addToCtx });
    }
    if (TERM === 'xterm-256color') {
      readline.cursorTo(process.stdout, 0, null);
    } else {
      process.stdout.write(' ');
    }
    process.stdout.write("✗\n");
    console.error(error.message || error);
    return { rc: 1, ctx };
  });

const runTests = (ctx, tests) => tests.filter(
  ({ name }) => testFilter === undefined || name === testFilter
).reduce((promise, test) => promise
  .then(({ rc, ctx }) => runTest(ctx, test)
    .then(({ rc: newRc, ctx: newCtx }) => ({
      rc: rc || newRc,
      ctx: { ...ctx, ...newCtx }
    }))
  ), Promise.resolve({ rc: 0, ctx }));

const runSuite = (ctx, { name, tests }) => Promise.resolve(`${name || 'no name'}`)
  .then(console.log)
  .then(() => runTests(ctx, tests));

const runSuites = suites => suites.filter(
  ({ name }) => suiteFilter === undefined || name === suiteFilter
).reduce((promise, suite) => promise
  .then(({ rc, ctx }) => runSuite(ctx, suite)
    .then(({ rc: newRc, ctx: newCtx }) => ({
      rc: rc || newRc,
      ctx: { ...ctx, ...newCtx }
    }))
  ), Promise.resolve({ rc: 0, ctx: {} }));

const fullFolder = path.resolve(folder);

const log = message => { console.log(message); return message; };

return new Promise((resolve, reject) => fs.readdir(
  fullFolder,
  (error, files) => error ? reject(error) : resolve(files)
))
  .then(files => files.filter(file => /^.*\.js$/.test(file)))
  .then(testFiles => testFiles.map(testFile => require(`${fullFolder}/${testFile}`)))
  .then(runSuites)
  .then(result => exit(result))
  .catch(error => {
    console.error(error);
    exit(1);
  });
