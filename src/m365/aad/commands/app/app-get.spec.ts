import * as assert from 'assert';
import * as fs from 'fs';
import * as sinon from 'sinon';
import appInsights from '../../../../appInsights';
import auth from '../../../../Auth';
import { Logger } from '../../../../cli';
import Command from '../../../../Command';
import request from '../../../../request';
import { sinonUtil } from '../../../../utils';
import commands from '../../commands';
const command: Command = require('./app-get');

describe(commands.APP_GET, () => {
  let log: string[];
  let logger: Logger;
  let loggerLogSpy: sinon.SinonSpy;

  before(() => {
    sinon.stub(auth, 'restoreAuth').callsFake(() => Promise.resolve());
    sinon.stub(appInsights, 'trackEvent').callsFake(() => { });
    auth.service.connected = true;
  });

  beforeEach(() => {
    log = [];
    logger = {
      log: (msg: string) => {
        log.push(msg);
      },
      logRaw: (msg: string) => {
        log.push(msg);
      },
      logToStderr: (msg: string) => {
        log.push(msg);
      }
    };
    loggerLogSpy = sinon.spy(logger, 'log');
  });

  afterEach(() => {
    sinonUtil.restore([
      request.get,
      fs.existsSync,
      fs.readFileSync,
      fs.writeFileSync
    ]);
  });

  after(() => {
    sinonUtil.restore([
      auth.restoreAuth,
      appInsights.trackEvent
    ]);
    auth.service.connected = false;
  });

  it('has correct name', () => {
    assert.strictEqual(command.name.startsWith(commands.APP_GET), true);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('handles error when the app specified with the appId not found', (done) => {
    sinon.stub(request, 'get').callsFake(opts => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=appId eq '9b1b1e42-794b-4c71-93ac-5ed92488b67f'&$select=id`) {
        return Promise.resolve({ value: [] });
      }

      return Promise.reject(`Invalid request ${JSON.stringify(opts)}`);
    });

    command.action(logger, {
      options: {
        debug: false,
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f'
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(err.message, `No Azure AD application registration with ID 9b1b1e42-794b-4c71-93ac-5ed92488b67f found`);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('handles error when the app with the specified the name not found', (done) => {
    sinon.stub(request, 'get').callsFake(opts => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=displayName eq 'My%20app'&$select=id`) {
        return Promise.resolve({ value: [] });
      }

      return Promise.reject(`Invalid request ${JSON.stringify(opts)}`);
    });

    command.action(logger, {
      options: {
        debug: false,
        name: 'My app'
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(err.message, `No Azure AD application registration with name My app found`);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('handles error when multiple apps with the specified name found', (done) => {
    sinon.stub(request, 'get').callsFake(opts => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=displayName eq 'My%20app'&$select=id`) {
        return Promise.resolve({
          value: [
            { id: '9b1b1e42-794b-4c71-93ac-5ed92488b67f' },
            { id: '9b1b1e42-794b-4c71-93ac-5ed92488b67g' }
          ]
        });
      }

      return Promise.reject(`Invalid request ${JSON.stringify(opts)}`);
    });

    command.action(logger, {
      options: {
        debug: false,
        name: 'My app'
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(err.message, `Multiple Azure AD application registration with name My app found. Please disambiguate (app object IDs): 9b1b1e42-794b-4c71-93ac-5ed92488b67f, 9b1b1e42-794b-4c71-93ac-5ed92488b67g`);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('handles error when retrieving information about app through appId failed', (done) => {
    sinon.stub(request, 'get').callsFake(_ => Promise.reject('An error has occurred'));

    command.action(logger, {
      options: {
        debug: false,
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f'
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(err.message, `An error has occurred`);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('handles error when retrieving information about app through name failed', (done) => {
    sinon.stub(request, 'get').callsFake(_ => Promise.reject('An error has occurred'));

    command.action(logger, {
      options: {
        debug: false,
        name: 'My app'
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(err.message, `An error has occurred`);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('fails validation if appId and objectId specified', () => {
    const actual = command.validate({ options: { appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f', objectId: 'c75be2e1-0204-4f95-857d-51a37cf40be8' } });
    assert.notStrictEqual(actual, true);
  });

  it('fails validation if appId and name specified', () => {
    const actual = command.validate({ options: { appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f', name: 'My app' } });
    assert.notStrictEqual(actual, true);
  });

  it('fails validation if objectId and name specified', () => {
    const actual = command.validate({ options: { objectId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f', name: 'My app' } });
    assert.notStrictEqual(actual, true);
  });

  it('fails validation if neither appId, objectId, nor name specified', () => {
    const actual = command.validate({ options: {} });
    assert.notStrictEqual(actual, true);
  });

  it('fails validation if the objectId is not a valid guid', () => {
    const actual = command.validate({ options: { objectId: 'abc' } });
    assert.notStrictEqual(actual, true);
  });

  it('fails validation if the appId is not a valid guid', () => {
    const actual = command.validate({ options: { appId: 'abc' } });
    assert.notStrictEqual(actual, true);
  });

  it('passes validation if required options specified (appId)', () => {
    const actual = command.validate({ options: { appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f' } });
    assert.strictEqual(actual, true);
  });

  it('passes validation if required options specified (objectId)', () => {
    const actual = command.validate({ options: { objectId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f' } });
    assert.strictEqual(actual, true);
  });

  it('passes validation if required options specified (name)', () => {
    const actual = command.validate({ options: { name: 'My app' } });
    assert.strictEqual(actual, true);
  });

  it(`should get an Azure AD app registration by its app (client) ID. Doesn't save the app info if not requested`, (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=appId eq '9b1b1e42-794b-4c71-93ac-5ed92488b67f'&$select=id`) {
        return Promise.resolve({
          value: [
            {
              "id": "340a4aa3-1af6-43ac-87d8-189819003952",
              "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
              "createdDateTime": "2019-10-29T17:46:55Z",
              "displayName": "My App",
              "description": null
            }
          ]
        });
      }

      if ((opts.url as string).indexOf('/v1.0/myorganization/applications/') > -1) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }

      return Promise.reject('Invalid request');
    });
    const fsWriteFileSyncSpy = sinon.spy(fs, 'writeFileSync');

    command.action(logger, {
      options: {
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f'
      }
    }, () => {
      try {
        const call: sinon.SinonSpyCall = loggerLogSpy.lastCall;
        assert.strictEqual(call.args[0].id, '340a4aa3-1af6-43ac-87d8-189819003952');
        assert.strictEqual(call.args[0].appId, '9b1b1e42-794b-4c71-93ac-5ed92488b67f');
        assert.strictEqual(call.args[0].displayName, 'My App');
        assert(fsWriteFileSyncSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it(`should get an Azure AD app registration by its name. Doesn't save the app info if not requested`, (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=displayName eq 'My%20App'&$select=id`) {
        return Promise.resolve({
          value: [
            {
              "id": "340a4aa3-1af6-43ac-87d8-189819003952",
              "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
              "createdDateTime": "2019-10-29T17:46:55Z",
              "displayName": "My App",
              "description": null
            }
          ]
        });
      }

      if ((opts.url as string).indexOf('/v1.0/myorganization/applications/') > -1) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }

      return Promise.reject('Invalid request');
    });
    const fsWriteFileSyncSpy = sinon.spy(fs, 'writeFileSync');

    command.action(logger, {
      options: {
        name: 'My App'
      }
    }, () => {
      try {
        const call: sinon.SinonSpyCall = loggerLogSpy.lastCall;
        assert.strictEqual(call.args[0].id, '340a4aa3-1af6-43ac-87d8-189819003952');
        assert.strictEqual(call.args[0].appId, '9b1b1e42-794b-4c71-93ac-5ed92488b67f');
        assert.strictEqual(call.args[0].displayName, 'My App');
        assert(fsWriteFileSyncSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it(`should get an Azure AD app registration by its object ID. Doesn't save the app info if not requested`, (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications/340a4aa3-1af6-43ac-87d8-189819003952`) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }
      return Promise.reject('Invalid request');
    });
    const fsWriteFileSyncSpy = sinon.spy(fs, 'writeFileSync');

    command.action(logger, {
      options: {
        objectId: '340a4aa3-1af6-43ac-87d8-189819003952'
      }
    }, () => {
      try {
        const call: sinon.SinonSpyCall = loggerLogSpy.lastCall;
        assert.strictEqual(call.args[0].id, '340a4aa3-1af6-43ac-87d8-189819003952');
        assert.strictEqual(call.args[0].appId, '9b1b1e42-794b-4c71-93ac-5ed92488b67f');
        assert.strictEqual(call.args[0].displayName, 'My App');
        assert(fsWriteFileSyncSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it(`should get an Azure AD app registration by its app (client) ID. Creates the file it doesn't exist`, (done) => {
    let fileContents: string | undefined;
    let filePath: string | undefined;
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=appId eq '9b1b1e42-794b-4c71-93ac-5ed92488b67f'&$select=id`) {
        return Promise.resolve({
          value: [
            {
              "id": "340a4aa3-1af6-43ac-87d8-189819003952",
              "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
              "createdDateTime": "2019-10-29T17:46:55Z",
              "displayName": "My App",
              "description": null
            }
          ]
        });
      }

      if ((opts.url as string).indexOf('/v1.0/myorganization/applications/') > -1) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }

      return Promise.reject('Invalid request');
    });
    sinon.stub(fs, 'existsSync').callsFake(_ => false);
    sinon.stub(fs, 'writeFileSync').callsFake((_, contents) => {
      filePath = _.toString();
      fileContents = contents as string;
    });

    command.action(logger, {
      options: {
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
        save: true
      }
    }, () => {
      try {
        const call: sinon.SinonSpyCall = loggerLogSpy.lastCall;
        assert.strictEqual(call.args[0].id, '340a4aa3-1af6-43ac-87d8-189819003952');
        assert.strictEqual(call.args[0].appId, '9b1b1e42-794b-4c71-93ac-5ed92488b67f');
        assert.strictEqual(call.args[0].displayName, 'My App');
        assert.strictEqual(filePath, '.m365rc.json');
        assert.strictEqual(fileContents, JSON.stringify({
          apps: [{
            appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
            name: 'My App'
          }]
        }, null, 2));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it(`should get an Azure AD app registration by its app (client) ID. Writes to the existing empty file`, (done) => {
    let fileContents: string | undefined;
    let filePath: string | undefined;
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=appId eq '9b1b1e42-794b-4c71-93ac-5ed92488b67f'&$select=id`) {
        return Promise.resolve({
          value: [
            {
              "id": "340a4aa3-1af6-43ac-87d8-189819003952",
              "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
              "createdDateTime": "2019-10-29T17:46:55Z",
              "displayName": "My App",
              "description": null
            }
          ]
        });
      }

      if ((opts.url as string).indexOf('/v1.0/myorganization/applications/') > -1) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }

      return Promise.reject('Invalid request');
    });
    sinon.stub(fs, 'existsSync').callsFake(_ => true);
    sinon.stub(fs, 'readFileSync').callsFake(_ => '');
    sinon.stub(fs, 'writeFileSync').callsFake((_, contents) => {
      filePath = _.toString();
      fileContents = contents as string;
    });

    command.action(logger, {
      options: {
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
        save: true
      }
    }, () => {
      try {
        const call: sinon.SinonSpyCall = loggerLogSpy.lastCall;
        assert.strictEqual(call.args[0].id, '340a4aa3-1af6-43ac-87d8-189819003952');
        assert.strictEqual(call.args[0].appId, '9b1b1e42-794b-4c71-93ac-5ed92488b67f');
        assert.strictEqual(call.args[0].displayName, 'My App');
        assert.strictEqual(filePath, '.m365rc.json');
        assert.strictEqual(fileContents, JSON.stringify({
          apps: [{
            appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
            name: 'My App'
          }]
        }, null, 2));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it(`should get an Azure AD app registration by its app (client) ID. Adds to the existing file contents`, (done) => {
    let fileContents: string | undefined;
    let filePath: string | undefined;
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=appId eq '9b1b1e42-794b-4c71-93ac-5ed92488b67f'&$select=id`) {
        return Promise.resolve({
          value: [
            {
              "id": "340a4aa3-1af6-43ac-87d8-189819003952",
              "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
              "createdDateTime": "2019-10-29T17:46:55Z",
              "displayName": "My App",
              "description": null
            }
          ]
        });
      }

      if ((opts.url as string).indexOf('/v1.0/myorganization/applications/') > -1) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }

      return Promise.reject('Invalid request');
    });
    sinon.stub(fs, 'existsSync').callsFake(_ => true);
    sinon.stub(fs, 'readFileSync').callsFake(_ => JSON.stringify({
      "apps": [
        {
          "appId": "74ad36da-3704-4e67-ba08-8c8e833f3c52",
          "name": "M365 app"
        }
      ]
    }));
    sinon.stub(fs, 'writeFileSync').callsFake((_, contents) => {
      filePath = _.toString();
      fileContents = contents as string;
    });

    command.action(logger, {
      options: {
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
        save: true
      }
    }, () => {
      try {
        const call: sinon.SinonSpyCall = loggerLogSpy.lastCall;
        assert.strictEqual(call.args[0].id, '340a4aa3-1af6-43ac-87d8-189819003952');
        assert.strictEqual(call.args[0].appId, '9b1b1e42-794b-4c71-93ac-5ed92488b67f');
        assert.strictEqual(call.args[0].displayName, 'My App');
        assert.strictEqual(filePath, '.m365rc.json');
        assert.strictEqual(fileContents, JSON.stringify({
          apps: [
            {
              "appId": "74ad36da-3704-4e67-ba08-8c8e833f3c52",
              "name": "M365 app"
            },
            {
              appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
              name: 'My App'
            }]
        }, null, 2));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it(`should get an Azure AD app registration by its app (client) ID. Adds to the existing file contents (Debug)`, (done) => {
    let fileContents: string | undefined;
    let filePath: string | undefined;
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=appId eq '9b1b1e42-794b-4c71-93ac-5ed92488b67f'&$select=id`) {
        return Promise.resolve({
          value: [
            {
              "id": "340a4aa3-1af6-43ac-87d8-189819003952",
              "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
              "createdDateTime": "2019-10-29T17:46:55Z",
              "displayName": "My App",
              "description": null
            }
          ]
        });
      }

      if ((opts.url as string).indexOf('/v1.0/myorganization/applications/') > -1) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }

      return Promise.reject('Invalid request');
    });
    sinon.stub(fs, 'existsSync').callsFake(_ => true);
    sinon.stub(fs, 'readFileSync').callsFake(_ => JSON.stringify({
      "apps": [
        {
          "appId": "74ad36da-3704-4e67-ba08-8c8e833f3c52",
          "name": "M365 app"
        }
      ]
    }));
    sinon.stub(fs, 'writeFileSync').callsFake((_, contents) => {
      filePath = _.toString();
      fileContents = contents as string;
    });

    command.action(logger, {
      options: {
        debug: true,
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
        save: true
      }
    }, () => {
      try {
        const call: sinon.SinonSpyCall = loggerLogSpy.lastCall;
        assert.strictEqual(call.args[0].id, '340a4aa3-1af6-43ac-87d8-189819003952');
        assert.strictEqual(call.args[0].appId, '9b1b1e42-794b-4c71-93ac-5ed92488b67f');
        assert.strictEqual(call.args[0].displayName, 'My App');
        assert.strictEqual(filePath, '.m365rc.json');
        assert.strictEqual(fileContents, JSON.stringify({
          apps: [
            {
              "appId": "74ad36da-3704-4e67-ba08-8c8e833f3c52",
              "name": "M365 app"
            },
            {
              appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
              name: 'My App'
            }]
        }, null, 2));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it(`doesn't save app info in the .m365rc.json file when there was error reading file contents`, (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=appId eq '9b1b1e42-794b-4c71-93ac-5ed92488b67f'&$select=id`) {
        return Promise.resolve({
          value: [
            {
              "id": "340a4aa3-1af6-43ac-87d8-189819003952",
              "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
              "createdDateTime": "2019-10-29T17:46:55Z",
              "displayName": "My App",
              "description": null
            }
          ]
        });
      }

      if ((opts.url as string).indexOf('/v1.0/myorganization/applications/') > -1) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }

      return Promise.reject('Invalid request');
    });
    sinon.stub(fs, 'existsSync').callsFake(_ => true);
    sinon.stub(fs, 'readFileSync').callsFake(_ => { throw new Error('An error has occurred'); });
    const fsWriteFileSyncSpy = sinon.spy(fs, 'writeFileSync');

    command.action(logger, {
      options: {
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
        save: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(typeof err, 'undefined');
        assert(fsWriteFileSyncSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it(`doesn't save app info in the .m365rc.json file when file has invalid JSON`, (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=appId eq '9b1b1e42-794b-4c71-93ac-5ed92488b67f'&$select=id`) {
        return Promise.resolve({
          value: [
            {
              "id": "340a4aa3-1af6-43ac-87d8-189819003952",
              "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
              "createdDateTime": "2019-10-29T17:46:55Z",
              "displayName": "My App",
              "description": null
            }
          ]
        });
      }

      if ((opts.url as string).indexOf('/v1.0/myorganization/applications/') > -1) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }

      return Promise.reject('Invalid request');
    });
    sinon.stub(fs, 'existsSync').callsFake(_ => true);
    sinon.stub(fs, 'readFileSync').callsFake(_ => '{');
    const fsWriteFileSyncSpy = sinon.spy(fs, 'writeFileSync');

    command.action(logger, {
      options: {
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
        save: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(typeof err, 'undefined');
        assert(fsWriteFileSyncSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it(`doesn't fail execution when error occurred while saving app info`, (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/myorganization/applications?$filter=appId eq '9b1b1e42-794b-4c71-93ac-5ed92488b67f'&$select=id`) {
        return Promise.resolve({
          value: [
            {
              "id": "340a4aa3-1af6-43ac-87d8-189819003952",
              "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
              "createdDateTime": "2019-10-29T17:46:55Z",
              "displayName": "My App",
              "description": null
            }
          ]
        });
      }

      if ((opts.url as string).indexOf('/v1.0/myorganization/applications/') > -1) {
        return Promise.resolve({
          "id": "340a4aa3-1af6-43ac-87d8-189819003952",
          "appId": "9b1b1e42-794b-4c71-93ac-5ed92488b67f",
          "createdDateTime": "2019-10-29T17:46:55Z",
          "displayName": "My App",
          "description": null
        });
      }

      return Promise.reject('Invalid request');
    });
    sinon.stub(fs, 'existsSync').callsFake(_ => false);
    sinon.stub(fs, 'writeFileSync').callsFake(_ => { throw new Error('Error occurred while saving app info'); });


    command.action(logger, {
      options: {
        appId: '9b1b1e42-794b-4c71-93ac-5ed92488b67f',
        save: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(typeof err, 'undefined');
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('supports debug mode', () => {
    const options = command.options();
    let containsOption = false;
    options.forEach(o => {
      if (o.option === '--debug') {
        containsOption = true;
      }
    });
    assert(containsOption);
  });
});