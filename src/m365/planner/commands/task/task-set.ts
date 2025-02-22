import { Group, PlannerBucket, PlannerTask, PlannerTaskDetails, User } from '@microsoft/microsoft-graph-types';
import { Logger } from '../../../../cli';
import { CommandOption } from '../../../../Command';
import { AppliedCategories } from '../../AppliedCategories';
import { accessToken, formatting, validation } from '../../../../utils';
import Auth from '../../../../Auth';
import GlobalOptions from '../../../../GlobalOptions';
import request from '../../../../request';
import { planner } from '../../../../utils/planner';
import GraphCommand from '../../../base/GraphCommand';
import commands from '../../commands';

interface CommandArgs {
  options: Options;
}

interface Options extends GlobalOptions {
  id: string;
  title?: string;
  planId?: string;
  planName?: string;
  ownerGroupId?: string;
  ownerGroupName?: string;
  bucketId?: string;
  bucketName?: string;
  startDateTime?: string;
  dueDateTime?: string;
  percentComplete?: number;
  assignedToUserIds?: string;
  assignedToUserNames?: string;
  assigneePriority?: string;
  assignments?: string;
  description?: string;
  appliedCategories?: string;
  orderHint?: string;
}

class PlannerTaskSetCommand extends GraphCommand {
  private assignments: { [userId: string]: { [property: string]: string; }; } | undefined;
  private bucketId: string | undefined;
  private allowedAppliedCategories: string[] = ['category1', 'category2', 'category3', 'category4', 'category5', 'category6'];

  public get name(): string {
    return commands.TASK_SET;
  }

  public get description(): string {
    return 'Updates a Microsoft Planner Task';
  }

  public getTelemetryProperties(args: CommandArgs): any {
    const telemetryProps: any = super.getTelemetryProperties(args);
    telemetryProps.title = typeof args.options.title !== 'undefined';
    telemetryProps.planId = typeof args.options.planId !== 'undefined';
    telemetryProps.planName = typeof args.options.planName !== 'undefined';
    telemetryProps.ownerGroupId = typeof args.options.ownerGroupId !== 'undefined';
    telemetryProps.ownerGroupName = typeof args.options.ownerGroupName !== 'undefined';
    telemetryProps.bucketId = typeof args.options.bucketId !== 'undefined';
    telemetryProps.bucketName = typeof args.options.bucketName !== 'undefined';
    telemetryProps.startDateTime = typeof args.options.startDateTime !== 'undefined';
    telemetryProps.dueDateTime = typeof args.options.dueDateTime !== 'undefined';
    telemetryProps.percentComplete = typeof args.options.percentComplete !== 'undefined';
    telemetryProps.assignedToUserIds = typeof args.options.assignedToUserIds !== 'undefined';
    telemetryProps.assignedToUserNames = typeof args.options.assignedToUserNames !== 'undefined';
    telemetryProps.assigneePriority = typeof args.options.assigneePriority !== 'undefined';
    telemetryProps.description = typeof args.options.description !== 'undefined';
    telemetryProps.appliedCategories = typeof args.options.appliedCategories !== 'undefined';
    telemetryProps.orderHint = typeof args.options.orderHint !== 'undefined';
    return telemetryProps;
  }

  public commandAction(logger: Logger, args: CommandArgs, cb: () => void): void {
    if (accessToken.isAppOnlyAccessToken(Auth.service.accessTokens[this.resource].accessToken)) {
      this.handleError('This command does not support application permissions.', logger, cb);
      return;
    }
    
    this
      .getBucketId(args.options)
      .then(bucketId => {
        this.bucketId = bucketId;

        return this.generateUserAssignments(args.options);
      })
      .then(resultAssignments => {
        this.assignments = resultAssignments;

        return this.getTaskEtag(args.options.id);
      })
      .then(etag => {
        const appliedCategories = this.generateAppliedCategories(args.options);
        const data = this.mapRequestBody(args.options, appliedCategories);

        const requestOptions: any = {
          url: `${this.resource}/v1.0/planner/tasks/${args.options.id}`,
          headers: {
            'accept': 'application/json;odata.metadata=none',
            'If-Match': etag,
            'Prefer': 'return=representation'
          },
          responseType: 'json',
          data: data
        };

        return request.patch(requestOptions) as PlannerTask;
      })
      .then(newTask => this.updateTaskDetails(args.options, newTask))
      .then((res: any): void => {
        logger.log(res);
        cb();
      }, (err: any): void => this.handleRejectedODataJsonPromise(err, logger, cb));
  }

  private updateTaskDetails(options: Options, newTask: PlannerTask): Promise<PlannerTask & PlannerTaskDetails> {
    if (!options.description) {
      return Promise.resolve(newTask);
    }

    const taskId = newTask.id as string;

    return this
      .getTaskDetailsEtag(taskId)
      .then(etag => {
        const requestOptionsTaskDetails: any = {
          url: `${this.resource}/v1.0/planner/tasks/${taskId}/details`,
          headers: {
            'accept': 'application/json;odata.metadata=none',
            'If-Match': etag,
            'Prefer': 'return=representation'
          },
          responseType: 'json',
          data: {
            description: options.description
          }
        };

        return request.patch(requestOptionsTaskDetails);
      })
      .then(taskDetails => {
        return { ...newTask, ...taskDetails as PlannerTaskDetails };
      });
  }

  private getTaskDetailsEtag(taskId: string): Promise<string> {
    const requestOptions: any = {
      url: `${this.resource}/v1.0/planner/tasks/${encodeURIComponent(taskId)}/details`,
      headers: {
        accept: 'application/json'
      },
      responseType: 'json'
    };

    return request
      .get(requestOptions)
      .then((response: any) => {
        const etag: string | undefined = response ? response['@odata.etag'] : undefined;

        if (!etag) {
          return Promise.reject(`Error fetching task details`);
        }

        return Promise.resolve(etag);
      });
  }

  private getTaskEtag(taskId: string): Promise<string> {
    const requestOptions: any = {
      url: `${this.resource}/v1.0/planner/tasks/${encodeURIComponent(taskId)}`,
      headers: {
        accept: 'application/json'
      },
      responseType: 'json'
    };

    return request
      .get(requestOptions)
      .then((response: any) => {
        const etag: string | undefined = response ? response['@odata.etag'] : undefined;

        if (!etag) {
          return Promise.reject(`Error fetching task`);
        }

        return Promise.resolve(etag);
      });
  }

  private generateAppliedCategories(options: Options): AppliedCategories {
    if (!options.appliedCategories) {
      return {};
    }

    const categories: AppliedCategories = {};
    options.appliedCategories.toLocaleLowerCase().split(',').forEach(x => categories[x] = true);
    return categories;
  }

  private generateUserAssignments(options: Options): Promise<{ [userId: string]: { [property: string]: string }; }> {
    const assignments: { [userId: string]: { [property: string]: string } } = {};

    if (!options.assignedToUserIds && !options.assignedToUserNames) {
      return Promise.resolve(assignments);
    }

    return this
      .getUserIds(options)
      .then((userIds) => {
        userIds.forEach(x => assignments[x] = {
          '@odata.type': '#microsoft.graph.plannerAssignment',
          orderHint: ' !'
        });

        return Promise.resolve(assignments);
      });
  }

  private getUserIds(options: Options): Promise<string[]> {
    if (options.assignedToUserIds) {
      return Promise.resolve(options.assignedToUserIds.split(',').map(o => o.trim()));
    }

    // Hitting this section means assignedToUserNames won't be undefined
    const userNames = options.assignedToUserNames as string;
    const userArr: string[] = userNames.split(',').map(o => o.trim());
    let userIds: string[] = [];

    const promises: Promise<{ value: User[] }>[] = userArr.map(user => {
      const requestOptions: any = {
        url: `${this.resource}/v1.0/users?$filter=userPrincipalName eq '${formatting.encodeQueryParameter(user)}'&$select=id,userPrincipalName`,
        headers: {
          'accept ': 'application/json;odata.metadata=none'
        },
        responseType: 'json'
      };

      return request.get(requestOptions);
    });

    return Promise
      .all(promises)
      .then((usersRes: { value: User[] }[]): Promise<string[]> => {
        let userUpns: string[] = [];

        userUpns = usersRes.map(res => res.value[0]?.userPrincipalName as string);
        userIds = usersRes.map(res => res.value[0]?.id as string);

        // Find the members where no graph response was found
        const invalidUsers = userArr.filter(user => !userUpns.some((upn) => upn?.toLowerCase() === user.toLowerCase()));

        if (invalidUsers && invalidUsers.length > 0) {
          return Promise.reject(`Cannot proceed with planner task update. The following users provided are invalid : ${invalidUsers.join(',')}`);
        }

        return Promise.resolve(userIds);
      });
  }

  private getBucketId(options: Options): Promise<string | undefined> {
    if (options.bucketId) {
      return Promise.resolve(options.bucketId);
    }

    if (!options.bucketName) {
      return Promise.resolve(undefined);
    }

    return this
      .getPlanId(options)
      .then(planId => {
        const requestOptions: any = {
          url: `${this.resource}/v1.0/planner/plans/${planId}/buckets?$select=id,name`,
          headers: {
            accept: 'application/json;odata.metadata=none'
          },
          responseType: 'json'
        };

        return request.get<{ value: PlannerBucket[] }>(requestOptions);
      })
      .then((response) => {
        const bucket: PlannerBucket | undefined = response.value.find(val => val.name === options.bucketName);

        if (!bucket) {
          return Promise.reject(`The specified bucket does not exist`);
        }

        return Promise.resolve(bucket.id as string);
      });
  }

  private getPlanId(options: Options): Promise<string> {
    if (options.planId) {
      return Promise.resolve(options.planId);
    }

    return this
      .getGroupId(options)
      .then((groupId: string) => planner.getPlanByName(options.planName!, groupId))
      .then(plan => plan.id!);
  }

  private getGroupId(options: Options): Promise<string> {
    if (options.ownerGroupId) {
      return Promise.resolve(options.ownerGroupId);
    }

    const requestOptions: any = {
      url: `${this.resource}/v1.0/groups?$filter=displayName eq '${encodeURIComponent(options.ownerGroupName as string)}'&$select=id`,
      headers: {
        accept: 'application/json;odata.metadata=none'
      },
      responseType: 'json'
    };

    return request
      .get<{ value: Group[] }>(requestOptions)
      .then(response => {
        const group: Group | undefined = response.value[0];

        if (!group) {
          return Promise.reject(`The specified owner group does not exist`);
        }

        return Promise.resolve(group.id as string);
      });
  }

  private mapRequestBody(options: Options, appliedCategories: AppliedCategories): any {
    const requestBody: any = {};

    if (options.title) {
      requestBody.title = options.title;
    }

    if (this.bucketId) {
      requestBody.bucketId = this.bucketId;
    }

    if (options.startDateTime) {
      requestBody.startDateTime = options.startDateTime;
    }

    if (options.dueDateTime) {
      requestBody.dueDateTime = options.dueDateTime;
    }

    if (options.percentComplete) {
      requestBody.percentComplete = options.percentComplete;
    }

    if (this.assignments && Object.keys(this.assignments).length > 0) {
      requestBody.assignments = this.assignments;
    }

    if (options.assigneePriority) {
      requestBody.assigneePriority = options.assigneePriority;
    }

    if (appliedCategories && Object.keys(appliedCategories).length > 0) {
      requestBody.appliedCategories = appliedCategories;
    }

    if (options.orderHint) {
      requestBody.orderHint = options.orderHint;
    }

    return requestBody;
  }

  public options(): CommandOption[] {
    const options: CommandOption[] = [
      { option: '-i, --id <id>' },
      { option: '-t, --title [title]' },
      { option: '--planId [planId]' },
      { option: '--planName [planName]' },
      { option: '--ownerGroupId [ownerGroupId]' },
      { option: '--ownerGroupName [ownerGroupName]' },
      { option: '--bucketId [bucketId]' },
      { option: '--bucketName [bucketName]' },
      { option: '--startDateTime [startDateTime]' },
      { option: '--dueDateTime [dueDateTime]' },
      { option: '--percentComplete [percentComplete]' },
      { option: '--assignedToUserIds [assignedToUserIds]' },
      { option: '--assignedToUserNames [assignedToUserNames]' },
      { option: '--assigneePriority [assigneePriority]' },
      { option: '--description [description]' },
      { option: '--appliedCategories [appliedCategories]' },
      { option: '--orderHint [orderHint]' }
    ];

    const parentOptions: CommandOption[] = super.options();
    return options.concat(parentOptions);
  }

  public validate(args: CommandArgs): boolean | string {
    if (args.options.bucketId && args.options.bucketName) {
      return 'Specify either bucketId or bucketName but not both';
    }

    if (args.options.bucketName && !args.options.planId && !args.options.planName) {
      return 'Specify either planId or planName when using bucketName';
    }

    if (args.options.bucketName && args.options.planId && args.options.planName) {
      return 'Specify either planId or planName when using bucketName but not both';
    }

    if (args.options.planName && !args.options.ownerGroupId && !args.options.ownerGroupName) {
      return 'Specify either ownerGroupId or ownerGroupName when using planName';
    }

    if (args.options.planName && args.options.ownerGroupId && args.options.ownerGroupName) {
      return 'Specify either ownerGroupId or ownerGroupName when using planName but not both';
    }

    if (args.options.ownerGroupId && !validation.isValidGuid(args.options.ownerGroupId as string)) {
      return `${args.options.ownerGroupId} is not a valid GUID`;
    }

    if (args.options.startDateTime && !validation.isValidISODateTime(args.options.startDateTime)) {
      return 'The startDateTime is not a valid ISO date string';
    }

    if (args.options.dueDateTime && !validation.isValidISODateTime(args.options.dueDateTime)) {
      return 'The dueDateTime is not a valid ISO date string';
    }

    if (args.options.percentComplete && isNaN(args.options.percentComplete)) {
      return `percentComplete is not a number`;
    }

    if (args.options.percentComplete && (args.options.percentComplete < 0 || args.options.percentComplete > 100)) {
      return `percentComplete should be between 0 and 100`;
    }

    if (args.options.assignedToUserIds && !validation.isValidGuidArray(args.options.assignedToUserIds.split(','))) {
      return 'assignedToUserIds contains invalid GUID';
    }

    if (args.options.assignedToUserIds && args.options.assignedToUserNames) {
      return 'Specify either assignedToUserIds or assignedToUserNames but not both';
    }
    if (args.options.appliedCategories && args.options.appliedCategories.split(',').filter(category => this.allowedAppliedCategories.indexOf(category.toLocaleLowerCase()) < 0).length !== 0) {
      return 'The appliedCategories contains invalid value. Specify either category1, category2, category3, category4, category5 and/or category6 as properties';
    }

    return true;
  }
}

module.exports = new PlannerTaskSetCommand();