import { Logger } from '../../../../cli';
import {
  CommandOption
} from '../../../../Command';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { validation } from '../../../../utils';
import GraphCommand from '../../../base/GraphCommand';
import commands from '../../commands';
import { AppRoleAssignment } from './AppRoleAssignment';
import { AppRole, ServicePrincipal } from './ServicePrincipal';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  appId?: string;
  displayName?: string;
  objectId?: string;
}

class AadAppRoleAssignmentListCommand extends GraphCommand {
  public get name(): string {
    return commands.APPROLEASSIGNMENT_LIST;
  }

  public get description(): string {
    return 'Lists app role assignments for the specified application registration';
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.appId = typeof args.options.appId !== 'undefined';
    telemetryProps.displayName = typeof args.options.displayName !== 'undefined';
    telemetryProps.objectId = typeof args.options.objectId !== 'undefined';
    return telemetryProps;
  }

  public defaultProperties(): string[] | undefined {
    return ['resourceDisplayName', 'roleName'];
  }

  public commandAction(logger: Logger, args: CommandArgs, cb: () => void): void {
    let spAppRoleAssignments: AppRoleAssignment[];

    this.getAppRoleAssignments(args.options)
      .then((appRoleAssignments: AppRoleAssignment[]) => {
        spAppRoleAssignments = appRoleAssignments;
        // the role assignment has an appRoleId but no name. To get the name,
        // we need to get all the roles from the resource. the resource is
        // a service principal. Multiple roles may have same resource id.
        const resourceIds = appRoleAssignments.map((item: AppRoleAssignment) => item.resourceId);

        const tasks: Promise<ServicePrincipal>[] = [];
        for (let i: number = 0; i < resourceIds.length; i++) {
          tasks.push(this.getServicePrincipal(resourceIds[i]));
        }

        return Promise.all(tasks);
      })
      .then((resources: ServicePrincipal[]) => {
        // loop through all appRoleAssignments for the servicePrincipal
        // and lookup the appRole.Id in the resources[resourceId].appRoles array...
        const results: any[] = [];
        spAppRoleAssignments.map((appRoleAssignment: AppRoleAssignment) => {
          const resource: ServicePrincipal | undefined = resources.find((r: any) => r.id === appRoleAssignment.resourceId);

          if (resource) {
            const appRole: AppRole | undefined = resource.appRoles.find((r: any) => r.id === appRoleAssignment.appRoleId);

            if (appRole) {
              results.push({
                appRoleId: appRoleAssignment.appRoleId,
                resourceDisplayName: appRoleAssignment.resourceDisplayName,
                resourceId: appRoleAssignment.resourceId,
                roleId: appRole.id,
                roleName: appRole.value,
                created: appRoleAssignment.createdDateTime,
                deleted: appRoleAssignment.deletedDateTime
              });
            }
          }
        });

        logger.log(results);
        cb();
      }, (err: any): void => this.handleRejectedODataJsonPromise(err, logger, cb));
  }

  private getAppRoleAssignments(argOptions: Options): Promise<AppRoleAssignment[]> {
    return new Promise<AppRoleAssignment[]>((resolve: (approleAssignments: AppRoleAssignment[]) => void, reject: (err: any) => void) => {
      if (argOptions.objectId) {
        this.getSPAppRoleAssignments(argOptions.objectId)
          .then(( spAppRoleAssignments: { value: AppRoleAssignment[] }) => {
            if (!spAppRoleAssignments.value.length) {
              reject('no app role assignments found');
            }

            resolve(spAppRoleAssignments.value);
          })
          .catch((err: any) => {
            reject(err);
          });
      }
      else {
        // Use existing way to get service principal object
        let spMatchQuery: string = '';
        if (argOptions.appId) {
          spMatchQuery = `appId eq '${encodeURIComponent(argOptions.appId)}'`;
        }
        else {
          spMatchQuery = `displayName eq '${encodeURIComponent(argOptions.displayName as string)}'`;
        } 
  
        this.getServicePrincipalForApp(spMatchQuery)
          .then((resp: { value: ServicePrincipal[] }) => {
            if (!resp.value.length) {
              reject('app registration not found');
            }
  
            resolve(resp.value[0].appRoleAssignments);
          })
          .catch((err: any) => {
            reject(err);
          });
      }
    });
  }

  private getSPAppRoleAssignments(spId: string): Promise<{ value: AppRoleAssignment[] }> {
    const spRequestOptions: any = {
      url: `${this.resource}/v1.0/servicePrincipals/${spId}/appRoleAssignments`,
      headers: {
        accept: 'application/json'
      },
      responseType: 'json'
    };

    return request.get<{ value: AppRoleAssignment[] }>(spRequestOptions);
  }

  private getServicePrincipalForApp(filterParam: string): Promise<{ value: ServicePrincipal[] }> {
    const spRequestOptions: any = {
      url: `${this.resource}/v1.0/servicePrincipals?$expand=appRoleAssignments&$filter=${filterParam}`,
      headers: {
        accept: 'application/json'
      },
      responseType: 'json'
    };

    return request.get<{ value: ServicePrincipal[] }>(spRequestOptions);
  }

  private getServicePrincipal(spId: string): Promise<ServicePrincipal> {
    const spRequestOptions: any = {
      url: `${this.resource}/v1.0/servicePrincipals/${spId}`,
      headers: {
        accept: 'application/json'
      },
      responseType: 'json'
    };

    return request.get<ServicePrincipal>(spRequestOptions);
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      {
        option: '-i, --appId [appId]'
      },
      {
        option: '-n, --displayName [displayName]'
      },
      {
        option: '--objectId [objectId]'
      }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(args: CommandArgs): boolean | string {
    if (!args.options.appId && !args.options.displayName && !args.options.objectId) {
      return 'Specify either appId, objectId or displayName';
    }

    if (args.options.appId && !validation.isValidGuid(args.options.appId)) {
      return `${args.options.appId} is not a valid GUID`;
    }

    if (args.options.objectId && !validation.isValidGuid(args.options.objectId)) {
      return `${args.options.objectId} is not a valid GUID`;
    }

    let optionsSpecified: number = 0;
    optionsSpecified += args.options.appId ? 1 : 0;
    optionsSpecified += args.options.displayName ? 1 : 0;
    optionsSpecified += args.options.objectId ? 1 : 0;
    if (optionsSpecified > 1) {
      return 'Specify either appId, objectId or displayName';
    }

    return true;
  }
}

module.exports = new AadAppRoleAssignmentListCommand();