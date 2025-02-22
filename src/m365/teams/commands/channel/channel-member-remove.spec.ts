import * as assert from 'assert';
import * as sinon from 'sinon';
import appInsights from '../../../../appInsights';
import auth from '../../../../Auth';
import { Cli, Logger } from '../../../../cli';
import Command, { CommandError } from '../../../../Command';
import request from '../../../../request';
import { sinonUtil } from '../../../../utils';
import commands from '../../commands';
const command: Command = require('./channel-member-remove');

describe(commands.CHANNEL_MEMBER_REMOVE, () => {
  const groupsResponse = {
    value: [
      {
        "id": "00000000-0000-0000-0000-000000000000",
        "resourceProvisioningOptions": [
          "Team"
        ]
      }
    ]
  };

  let log: string[];
  let logger: Logger;
  let promptOptions: any;

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

    promptOptions = undefined;

    sinon.stub(Cli, 'prompt').callsFake((options: any, cb: (result: { continue: boolean }) => void) => {
      promptOptions = options;
      cb({ continue: true });
    });
    (command as any).items = [];
  });

  afterEach(() => {
    sinonUtil.restore([
      Cli.prompt,
      request.get,
      request.delete
    ]);
  });

  after(() => {
    sinonUtil.restore([
      auth.restoreAuth,
      appInsights.trackEvent
    ]);
  });

  it('has correct name', () => {
    assert.strictEqual(command.name.startsWith(commands.CHANNEL_MEMBER_REMOVE), true);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('defines correct option sets', () => {
    assert.deepStrictEqual(command.optionSets(), [
      ['teamId', 'teamName'],
      ['channelId', 'channelName'],
      ['userId', 'userName', 'id']
    ]);
  });


  it('defines correct alias', () => {
    const alias = command.alias();
    assert.strictEqual((alias && alias.indexOf(commands.CONVERSATIONMEMBER_REMOVE) !== -1), true);
  });

  it('fails validation if the teamId is not a valid guid', (done) => {
    const actual = command.validate({
      options: {
        teamId: '00000000-0000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000'
      }
    });
    assert.notStrictEqual(actual, true);
    done();
  });

  it('fails validation if channelId is invalid', (done) => {
    const actual = command.validate({
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: 'Invalid',
        id: '00000'
      }
    });
    assert.notStrictEqual(actual, true);
    done();
  });

  it('fails validation if the userId is not a valid guid', (done) => {
    const actual = command.validate({
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        userId: '00000000-0000'
      }
    });
    assert.notStrictEqual(actual, true);
    done();
  });

  it('validates for a correct input.', (done) => {
    const actual = command.validate({
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000'
      }
    });
    assert.strictEqual(actual, true);
    done();
  });

  it('fails to get team when team does not exist', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/groups?$filter=displayName eq '`) > -1) {
        return Promise.resolve({ value: [] });
      }

      return Promise.reject('Invalid Request');
    });

    command.action(logger, {
      options: {
        teamName: 'Team Name',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError(`The specified team does not exist in the Microsoft Teams`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('fails to get team when resourceprovisioning does not exist', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/groups?$filter=displayName eq '`) > -1) {
        return Promise.resolve({
          value: [
            {
              "id": "00000000-0000-0000-0000-000000000000",
              "resourceProvisioningOptions": [
              ]
            },
            {
              "id": "00000000-0000-0000-0000-000000000000",
              "resourceProvisioningOptions": [
              ]
            }
          ]
        });
      }

      return Promise.reject('Invalid Request');
    });

    command.action(logger, {
      options: {
        teamName: 'Team Name',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError(`The specified team does not exist in the Microsoft Teams`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('fails when multiple teams with same name exists', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/groups?$filter=displayName eq '`) > -1) {
        return Promise.resolve({
          value: [
            {
              "id": "00000000-0000-0000-0000-000000000000",
              "resourceProvisioningOptions": [
                "Team"
              ]
            },
            {
              "id": "00000000-0000-0000-0000-000000000000",
              "resourceProvisioningOptions": [
                "Team"
              ]
            }
          ]
        });
      }

      return Promise.reject('Invalid Request');
    });

    command.action(logger, {
      options: {
        teamName: 'Team Name',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError(`Multiple Microsoft Teams teams with name Team Name found: 00000000-0000-0000-0000-000000000000,00000000-0000-0000-0000-000000000000`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('correctly get teams id by team name', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/groups?$filter=displayName eq '`) > -1) {
        return Promise.resolve(groupsResponse);
      }

      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'delete').callsFake((opts) => {
      if ((opts.url as string).indexOf('/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members/00000') > -1) {
        return Promise.resolve();
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamName: 'Team Name',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000',
        confirm: true
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

  it('fails to get channel when channel does not exist', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/teams/00000000-0000-0000-0000-000000000000/channels?$filter=displayName eq '`) > -1) {
        return Promise.resolve({
          "value": []
        });
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelName: 'Channel Name',
        id: '00000',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError(`The specified channel does not exist in the Microsoft Teams team`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });  

  it('fails to get channel when channel does is not private', (done) => {
    sinonUtil.restore(request.get);
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/teams/${encodeURIComponent('00000000-0000-0000-0000-000000000000')}/channels?$filter=displayName eq '${encodeURIComponent('Other Channel')}'`) {
        return Promise.resolve({
          "value": [
            {
              "name": "Other Channel",
              "membershipType": "standard"
            }
          ]
        });
      }

      return Promise.reject('Invalid Request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelName: 'Other Channel',
        id: '00000',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(
          JSON.stringify(err),
          JSON.stringify(new CommandError(`The specified channel is not a private channel`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('correctly get channel id by channel name', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/teams/00000000-0000-0000-0000-000000000000/channels?$filter=displayName eq '`) > -1) {
        return Promise.resolve({
          value: [
            {
              "id": "19:00000000000000000000000000000000@thread.skype",
              "membershipType": "private"
            }
          ]
        });
      }

      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'delete').callsFake((opts) => {
      if ((opts.url as string).indexOf('/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members/00000') > -1) {
        return Promise.resolve();
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelName: 'Channel Name',
        id: '00000',
        confirm: true
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

  it('fails to get member when member does not exist by userId', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members`) > -1) {
        return Promise.resolve({
          value: [
            {
              "id": "0",
              "displayName": "User 1",
              "userId": "00000000-0000-0000-0000-000000000001",
              "email": "user1@domainname.com",
              "roles": ["owner"]
            }
          ]
        });
      }
      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        userId: '00000000-0000-0000-0000-000000000000',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError(`The specified member does not exist in the Microsoft Teams channel`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('fails to get member when member does not return userId', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members`) > -1) {
        return Promise.resolve({
          value: [
            {
              "id": "0",
              "displayName": "User 1",
              "email": "user1@domainname.com",
              "roles": ["owner"]
            }
          ]
        });
      }
      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        userId: '00000000-0000-0000-0000-000000000000',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError(`The specified member does not exist in the Microsoft Teams channel`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('fails to get member when member does not exist by userName', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members`) {
        return Promise.resolve({
          value: [
            {
              "id": "0",
              "displayName": "User 1",
              "userId": "00000000-0000-0000-0000-000000000001",
              "email": "user1@domainname.com",
              "roles": ["owner"]
            }
          ]
        });
      }
      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        userName: 'user@domainname.com',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError(`The specified member does not exist in the Microsoft Teams channel`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('fails to get member when member does not return email', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members`) {
        return Promise.resolve({
          value: [
            {
              "id": "0",
              "displayName": "User 1",
              "userId": "00000000-0000-0000-0000-000000000001",
              "roles": ["owner"]
            }
          ]
        });
      }
      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        userName: 'user@domainname.com',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError(`The specified member does not exist in the Microsoft Teams channel`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('fails to get member when member does multiple exist with username', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members`) {
        return Promise.resolve({
          value: [
            {
              "id": "0",
              "displayName": "User 1",
              "userId": "00000000-0000-0000-0000-000000000001",
              "email": "user@domainname.com"
            },
            {
              "id": "1",
              "displayName": "User 2",
              "userId": "00000000-0000-0000-0000-000000000002",
              "email": "user@domainname.com"
            }
          ]
        });
      }
      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        userName: 'user@domainname.com',
        confirm: true
      }
    }, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError(`Multiple Microsoft Teams channel members with name user@domainname.com found: 00000000-0000-0000-0000-000000000001,00000000-0000-0000-0000-000000000002`)));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('correctly get member id by user id', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members`) {
        return Promise.resolve({
          value: [
            {
              "id": "00000",
              "displayName": "User",
              "userId": "00000000-0000-0000-0000-000000000000",
              "email": "user@domainname.com"
            }
          ]
        });
      }
      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'delete').callsFake((opts) => {
      if ((opts.url as string).indexOf('/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members/00000') > -1) {
        return Promise.resolve();
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        userId: '00000000-0000-0000-0000-000000000000',
        confirm: true
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

  it('correctly get member id by user name', (done) => {
    sinon.stub(request, 'get').callsFake((opts) => {
      if (opts.url === `https://graph.microsoft.com/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members`) {
        return Promise.resolve({
          value: [
            {
              "id": "00000",
              "displayName": "User",
              "userId": "00000000-0000-0000-0000-000000000000",
              "email": "user@domainname.com"
            }
          ]
        });
      }
      return Promise.reject('Invalid request');
    });

    sinon.stub(request, 'delete').callsFake((opts) => {
      if ((opts.url as string).indexOf('/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members/00000') > -1) {
        return Promise.resolve();
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        userName: 'user@domainname.com',
        confirm: true
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

  it('removes user from team with confirm', (done) => {
    sinon.stub(request, 'delete').callsFake((opts) => {
      if ((opts.url as string).indexOf('/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members/00000') > -1) {
        return Promise.resolve();
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000',
        confirm: true
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

  it('removes user from team with prompting', (done) => {
    sinon.stub(request, 'delete').callsFake((opts) => {
      if ((opts.url as string).indexOf('/v1.0/teams/00000000-0000-0000-0000-000000000000/channels/19:00000000000000000000000000000000@thread.skype/members/00000') > -1) {
        return Promise.resolve();
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000'
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
  it('aborts user removal when prompt not confirmed', (done) => {
    const postSpy = sinon.spy(request, 'delete');
    sinonUtil.restore(Cli.prompt);
    sinon.stub(Cli, 'prompt').callsFake((options: any, cb: (result: { continue: boolean }) => void) => {
      cb({ continue: false });
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000'
      }
    }, () => {
      try {
        assert(postSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('prompts before user removal when confirm option not passed', (done) => {
    sinonUtil.restore(Cli.prompt);
    sinon.stub(Cli, 'prompt').callsFake((options: any, cb: (result: { continue: boolean }) => void) => {
      promptOptions = options;
      cb({ continue: false });
    });

    command.action(logger, {
      options: {
        teamId: '00000000-0000-0000-0000-000000000000',
        channelId: '19:00000000000000000000000000000000@thread.skype',
        id: '00000'
      }
    }, () => {
      let promptIssued = false;

      if (promptOptions && promptOptions.type === 'confirm') {
        promptIssued = true;
      }

      try {
        assert(promptIssued);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('correctly handles error when retrieving all teams', (done) => {
    sinon.stub(request, 'get').callsFake(() => {
      return Promise.reject('An error has occurred');
    });

    command.action(logger, {
      options: {
        debug: false,
        confirm: true,
        teamId: '00000000-0000-0000-0000-000000000000'
      }
    } as any, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError('An error has occurred')));
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
