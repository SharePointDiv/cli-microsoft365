# planner task add

Adds a new Microsoft Planner task

## Usage

```sh
m365 planner task add [options]
```

## Options

`-t, --title <title>`
: Title of the task to add.

`--planId [planId]`
: Plan ID to which the task belongs. Specify either `planId` or `planName` but not both.

`--planName [planName]`
: Plan Name to which the task belongs. Specify either `planId` or `planName` but not both.

`--ownerGroupId [ownerGroupId]`
: ID of the group to which the plan belongs. Specify `ownerGroupId` or `ownerGroupName` when using `planName`.

`--ownerGroupName [ownerGroupName]`
: Name of the group to which the plan belongs. Specify `ownerGroupId` or `ownerGroupName` when using `planName`.

`--bucketId [bucketId]`
: Bucket ID to which the task belongs. The bucket needs to exist in the selected plan. Specify either `bucketId` or `bucketName` but not both.

`--bucketName [bucketName]`
: Bucket Name to which the task belongs. The bucket needs to exist in the selected plan. Specify either `bucketId` or `bucketName` but not both.

`--startDateTime [startDateTime]`
: The date and time when the task started. This should be defined as a valid ISO 8601 string. `2021-12-16T18:28:48.6964197Z`

`--dueDateTime [dueDateTime]`
: The date and time when the task is due. This should be defined as a valid ISO 8601 string. `2021-12-16T18:28:48.6964197Z`

`--percentComplete [percentComplete]`
: Percentage of task completion. Number between 0 and 100.
  - When set to 0, the task is considered _Not started_. 
  - When set between 1 and 99, the task is considered _In progress_.
  - When set to 100, the task is considered _Completed_.

`--assignedToUserIds [assignedToUserIds]`
: The comma-separated IDs of the assignees the task is assigned to. Specify either `assignedToUserIds` or `assignedToUserNames` but not both.

`--assignedToUserNames [assignedToUserNames]`
: The comma-separated UPNs of the assignees the task is assigned to. Specify either `assignedToUserIds` or `assignedToUserNames` but not both.

`--description [description]`
: Description of the task

`--orderHint [orderHint]`
: Hint used to order items of this type in a list view. The format is defined as outlined [here](https://docs.microsoft.com/en-us/graph/api/resources/planner-order-hint-format?view=graph-rest-1.0).

--8<-- "docs/cmd/_global.md"

## Examples

Adds a Microsoft Planner task with the name _My Planner Task_ for plan with the ID _8QZEH7b3wkSbGQobscsM5gADCBa_ and for the bucket with the ID _IK8tuFTwQEa5vTonM7ZMRZgAKdna_

```sh
m365 planner task add --title "My Planner Task" --planId "8QZEH7b3wkSbGQobscsM5gADCBa" --bucketId "IK8tuFTwQEa5vTonM7ZMRZgAKdna"
```

Adds a Completed Microsoft Planner task with the name _My Planner Task_ for plan with the name _My Planner Plan_ owned by group _My Planner Group_ and for the bucket with the ID _IK8tuFTwQEa5vTonM7ZMRZgAKdna_

```sh
m365 planner task add --title "My Planner task" --planName "My Planner Plan" --ownerGroupName "My Planner Group" --bucketId "IK8tuFTwQEa5vTonM7ZMRZgAKdna" --percentComplete 100
```

Adds a Microsoft Planner task with the name _My Planner Task_ for plan with the ID _8QZEH7b3wkbGQobscsM5gADCBa_ and for the bucket with the ID _IK8tuFTwQEa5vTonM7ZMRZgAKdna_. The new task will be assigned to the users _Allan.Carroll@contoso.com_ and _Ida.Stevens@contoso.com_ and receive a due date for _2021-12-16_

```sh
m365 planner task add --title "My Planner Task" --planId "8QZEH7b3wkSbGQobscsM5gADCBa" --bucketId "IK8tuFTwQEa5vTonM7ZMRZgAKdna" --assignedToUserNames "Allan.Carroll@contoso.com,Ida.Stevens@contoso.com" --dueDateTime "2021-12-16"
```
