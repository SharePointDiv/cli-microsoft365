import { Channel } from '@microsoft/microsoft-graph-types';
import { Logger } from '../../../../cli';
import { CommandOption } from '../../../../Command';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { odata, validation } from '../../../../utils';
import GraphCommand from '../../../base/GraphCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  teamId?: string;
  teamName?: string;
  type?: string;
}

class TeamsChannelListCommand extends GraphCommand{
  public get name(): string {
    return commands.CHANNEL_LIST;
  }

  public get description(): string {
    return 'Lists channels in the specified Microsoft Teams team';
  }

  public defaultProperties(): string[] | undefined {
    return ['id', 'displayName'];
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.teamId = typeof args.options.teamId !== 'undefined';
    telemetryProps.teamName = typeof args.options.teamName !== 'undefined';
    return telemetryProps;
  }

  private getTeamId(args: CommandArgs): Promise<string> {
    if (args.options.teamId) {
      return Promise.resolve(args.options.teamId);
    }

    const requestOptions: any = {
      url: `${this.resource}/v1.0/groups?$filter=displayName eq '${encodeURIComponent(args.options.teamName as string)}'`,
      headers: {
        accept: 'application/json;odata.metadata=none'
      },
      responseType: 'json'
    };

    return request
      .get<{ value: [{ id: string, resourceProvisioningOptions: string[] }] }>(requestOptions)
      .then(response => {
        const filteredResponseByTeam: { id: string, resourceProvisioningOptions: string[] }[] = response.value.filter(t => t.resourceProvisioningOptions.includes('Team'));
        const groupItem: { id: string } | undefined = filteredResponseByTeam[0];

        if (!groupItem) {
          return Promise.reject(`The specified team does not exist in the Microsoft Teams`);
        }

        if (filteredResponseByTeam.length > 1) {
          return Promise.reject(`Multiple Microsoft Teams teams with name ${args.options.teamName} found: ${filteredResponseByTeam.map(x => x.id)}`);
        }

        return Promise.resolve(groupItem.id);
      });
  }

  public commandAction(logger: Logger, args: CommandArgs, cb: () => void): void {
    this
      .getTeamId(args)
      .then((teamId: string): Promise<Channel[]> => {
        let endpoint: string = `${this.resource}/v1.0/teams/${teamId}/channels`;
        if (args.options.type) {
          endpoint += `?$filter=membershipType eq '${args.options.type}'`;
        }

        return odata.getAllItems<Channel>(endpoint);
      })
      .then((items): void => {
        logger.log(items);
        cb();
      }, (err: any): void => this.handleRejectedODataJsonPromise(err, logger, cb));
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: '-i, --teamId [teamId]'
      },
      {
        option: '--teamName [teamName]'
      },
      {
        option: '--type [type]',
        autocomplete: ['standard', 'private']
      }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(args: CommandArgs): boolean | string {
    if (args.options.teamId && args.options.teamName) {
      return 'Specify either teamId or teamName, but not both';
    }

    if (!args.options.teamId && !args.options.teamName) {
      return 'Specify teamId or teamName, one is required';
    }

    if (args.options.teamId && !validation.isValidGuid(args.options.teamId)) {
      return `${args.options.teamId} is not a valid GUID`;
    }

    if (args.options.type && ['standard', 'private'].indexOf(args.options.type.toLowerCase()) === -1) {
      return `${args.options.type} is not a valid type value. Allowed values standard|private`;
    }

    return true;
  }
}

module.exports = new TeamsChannelListCommand();