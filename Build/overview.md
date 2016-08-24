# Release Notes Task for VSTS
Task for VSTS to create release notes base on VSTS queries.

# Why Use this task?
This task is great for continuous deployment processes when you want to automatically generate release notes from VSTS. It is written on Node.Js to give flexibility on what type of build server it can run on. There is no particular logic cycle in VSTS that this task ties to so you can use this to create release notes regardless of the type of build server or how you track information in VSTS. If you can write a query or three to get the results you want in your release notes, you can use this task to create a release notes file.

# How does it work?
This task is designed to not be tied to any particular VSTS item statuses or logic cycles. Instead it can insert several different build variables and up to three query results into a template you create. The queries can point to any shared queries in your repository with the caveat that the queries must be accessible to the Project Collection Build Service. It will then add a list to the template, replacing the given line definition tokens with results such as the id, title and type of each VSTS item that is returned by the query.

For each of the three queries you can include it can also, if you specify it to do so, put the build id into the "Integrated in Build" field of any Task or Bug that the query returns. This is useful if your workflow for deciding what tasks and bugs are part of the build is partially dependent on if it was marked as part of a previous build. 

# How do I create a template?
A template is simply a text file and can be in any number of formats. This task will read in the text and do simple token replacement. You may use some or any of the following tokens which will be replaced with the given values:

## Simple replacement tokens:
- |BUILD_BUILDID| - The build id from the build environment variable of the same name.
- |BUILD_BUILDNUMBER| - The build number from the build environment variable of the same name.
- |BUILD_SOURCEVERSION| - The source version from the build environment variable of the same name.
- |BUILD_SOURCEBRANCHNAME| - The branch name from the build environment variable of the same name.
- |BUILD_REPOSITORY_URI| - The URI to the repository where the code exists for the build, from the build environment variable of the same name.
- |BUILD_BUILDURI| - The URI for this build, from the build environment variable of the same name.
- |CURRENT_DATE_UTC| - The date and time this task was run in UTC.

## First query relpacement tokens
- |START_DETAIL_LINE_ONE| - The start of a detail line for the first query. Line will be repeated for each result.
- |END_DETAIL_LINE_ONE| - The end of a detail line for the first query, must appear after the |START_DETAIL_LINE_ONE| tag.
- |DETAIL_ID_ONE| - The VSTS id of an element retuned from the first query. Must appear between the |START_DETAIL_LINE_ONE| and |END_DETAIL_LINE_ONE| tags to be effective.
- |DETAIL_TYPE_ONE| - The VSTS type of an element retuned from the first query such as bug, task or user story. Must appear between the |START_DETAIL_LINE_ONE| and |END_DETAIL_LINE_ONE| tags to be effective.
- |DETAIL_NAME_ONE| - The VSTS name of an element retuned from the first query. Must appear between the |START_DETAIL_LINE_ONE| and |END_DETAIL_LINE_ONE| tags to be effective.

## Second query relpacement tokens
- |START_DETAIL_LINE_TWO| - The start of a detail line for the second query. Line will be repeated for each result.
- |END_DETAIL_LINE_TWO| - The end of a detail line for the second query, must appear after the |START_DETAIL_LINE_TWO| tag.
- |DETAIL_ID_TWO| - The VSTS id of an element retuned from the second query. Must appear between the |START_DETAIL_LINE_TWO| and |END_DETAIL_LINE_TWO| tags to be effective.
- |DETAIL_TYPE_TWO| - The VSTS type of an element retuned from the second query such as bug, task or user story. Must appear between the |START_DETAIL_LINE_TWO| and |END_DETAIL_LINE_TWO| tags to be effective.
- |DETAIL_NAME_TWO| - The VSTS name of an element retuned from the second query. Must appear between the |START_DETAIL_LINE_TWO| and |END_DETAIL_LINE_TWO| tags to be effective.

## Third query relpacement tokens
- |START_DETAIL_LINE_THREE| - The start of a detail line for the third query. Line will be repeated for each result.
- |END_DETAIL_LINE_THREE| - The end of a detail line for the third query, must appear after the |START_DETAIL_LINE_THREE| tag.
- |DETAIL_ID_THREE| - The VSTS id of an element retuned from the third query. Must appear between the |START_DETAIL_LINE_THREE| and |END_DETAIL_LINE_THREE| tags to be effective.
- |DETAIL_TYPE_THREE| - The VSTS type of an element retuned from the third query such as bug, task or user story. Must appear between the |START_DETAIL_LINE_THREE| and |END_DETAIL_LINE_THREE| tags to be effective.
- |DETAIL_NAME_THREE| - The VSTS name of an element retuned from the third query. Must appear between the |START_DETAIL_LINE_THREE| and |END_DETAIL_LINE_THREE| tags to be effective.

Samples of build templates can be found in the templates directory.

# How do I set up the task

As part of the build add this task which should look like this:

![alt tag](https://github.com/Magenic/ReleaseNotesVSTSTask/blob/master/docs/TaskSetup.png?raw=true "Setup")

## Output file
The is the path and file name in the build to output the release notes file. You can then use this location to do something with the release notes, like add them to a HockeyApp upload. Here is an example:

BuildTest/ReleaseNotes.txt

This field is required

## Template file
The location of the template file. The template file must be located somewhere in your repository. The setup allows you to browse and select the template file. This should be a text file that uses whatever markup you need and contains any tokes you want to replace as part of the build process.

This field is required

## Guid for X query
These three fields take a query guid. Remember these queries should be setup in your VSTS project as a shared query and the Project Collection Build Service must have access to them. 

### Setting up security for the query
The following shows the settings for setting up security on the query:

Go to the query and select the security option:

![alt tag](https://github.com/Magenic/ReleaseNotesVSTSTask/blob/master/docs/EnterSecurity.png?raw=true "Security")

Add a user to the security configuration:

![alt tag](https://github.com/Magenic/ReleaseNotesVSTSTask/blob/master/docs/AddUser.png?raw=true "Add User")

Select to add the Project Collection Build Services user:

![alt tag](https://github.com/Magenic/ReleaseNotesVSTSTask/blob/master/docs/SelectUser.png?raw=true "Select User")

Make sure read is set to allow for the Project Collection Build Services and the Save Changes button is pressed:

![alt tag](https://github.com/Magenic/ReleaseNotesVSTSTask/blob/master/docs/UserSettings.png?raw=true "User Security Settings")

### Find out the guid of the query
You can find the quid of the query by opening a browser that is logged on to your VSTS account and navigate to a URL in the following format:

```
https://RepositoryURL/ProjectName/_apis/wit/queries/Shared%20Queries/LocationAndNameOfQuery?api-version=2.2
```

For example:

```
https://myclientaccount.visualstudio.com/My%20First%20Project/_apis/wit/queries/Shared%20Queries/Build/BugsForThisBuild?api-version=2.2
```

This will include detail information about the query including the query’s guid. Here is a sample result:

```
{"id":"c8baa21f-c7d1-490b-b261-ffe4120300f8","name":"BugsForThisBuild","path":"Shared Queries/Build/BugsForThisBuild","createdDate":"2016-08-16T23:38:05.383Z","lastModifiedBy":{"id":"5528747b-185b-408f-9d06-2a6c2cfe597f","displayName":"Kevin E. Ford \<person@mail.com>"},"lastModifiedDate":"2016-08-16T23:40:33.07Z","isPublic":true,"_links":{"self":{"href":"https://myclientaccount.visualstudio.com/fff06cd0-3cc3-463c-b68f-55a869e2cb70/_apis/wit/queries/c8baa21f-c7d1-490b-b261-ffe4120300f8"},"html":{"href":"https://myclientaccount.visualstudio.com/web/qr.aspx?pguid=fff06cd0-3cc3-463c-b68f-55a869e2cb70&qid=c8baa21f-c7d1-490b-b261-ffe4120300f8"},"parent":{"href":"https://myclientaccount.visualstudio.com/fff06cd0-3cc3-463c-b68f-55a869e2cb70/_apis/wit/queries/f94ddad9-afef-4d7c-84d6-5fbfecb15426"},"wiql":{"href":"https://myclientaccount.visualstudio.com/fff06cd0-3cc3-463c-b68f-55a869e2cb70/_apis/wit/wiql/c8baa21f-c7d1-490b-b261-ffe4120300f8"}},"url":"https://myclientaccount.visualstudio.com/fff06cd0-3cc3-463c-b68f-55a869e2cb70/_apis/wit/queries/c8baa21f-c7d1-490b-b261-ffe4120300f8"}
```

In this case the guid we want for the task is: c8baa21f-c7d1-490b-b261-ffe4120300f8. This guid should be entered in the appropriate guid for X query field.

### Query Output
The following three pieces of information can be output for every item returned by a query: Id, Title and Type. No other information can currently be returned. If the query has no results the line token will be replaced with an empty string.

For hierarchal queried the order of the results will be:</br>
- parent
- child
- grandchild
- child
- grandchild
- parent
- ...

## Add build number to bugs and tasks
Under each guid for X Query field there is a checkbox to allow the build id to be replaced in the "Integrated in build" field for bugs and tasks returned by the query id above it. If the query id is not filled out this field will have no effect.

The service updates the "Integrated in build" field for each returned task and bug asynchronously. There is no way to ensure the order of when these items will be complete.

#Setting up query results in your template using the line tokens
To create a section in your template for displaying query results you need to define a template line to use. This line will replace out any tokens it finds but leave any other text and tokens in place. For example, take the following line from a template for query one:

|START_DETAIL_LINE_ONE|VSTS Id: |DETAIL_ID_ONE|, Type: |DETAIL_TYPE_ONE|, Name: |DETAIL_NAME_ONE| |END_DETAIL_LINE_TWO|

For the first query when it returns a user story, task and bug this might be output to read:
VSTS Id: 45, Type: User Story, Name: First User Story VSTS Id: 122, Type: Task, Name: Some Task VSTS Id: 125, Type: Bug, Name: A bad bug

Notice the results will all run together unless you include something like a markup between the start and end tags to force a line break. You can also have line breaks within your detail result line, simply by adding the appropriate line break markup or characters.

# Sample Template
```
#Release Notes
</br>
## Build Number: |BUILD_BUILDID|
</br>
## Build Date: |CURRENT_DATE_UTC|
</br>
## Build Location: |BUILD_BUILDURI|
</br>
### Work items associated with this release
<table>
<tr><th>Id</th><th>Type</th><th>Name</th></tr>
|START_DETAIL_LINE_TWO|<tr><td>|DETAIL_ID_TWO|</td><td>|DETAIL_TYPE_TWO|</td><td>|DETAIL_NAME_TWO|</td></tr>|END_DETAIL_LINE_TWO|
</table>
</br>
### Bug Fixes associated with this release
<table>
<tr><th>Id</th><th>Type</th><th>Name</th></tr>
|START_DETAIL_LINE_ONE|<tr><td>|DETAIL_ID_ONE|</td><td>|DETAIL_TYPE_ONE|</td><td>|DETAIL_NAME_ONE|</td></tr>|END_DETAIL_LINE_ONE|
</table>
```

# Other relevant information
The "Integrated in build" fields of bugs and tasks can be updated without outputting results to the release notes file. To do this simply add a query for everything you want to update to one of the query slots, select Add build number to bugs and tasks and then do not include the query's line token information to the release notes template file.

The working directory on Windows build servers is set to the value of the BUILD_REPOSITORY_LOCALPATH environment variable. For servers such as Macs where this variable is not defined the working directory is left unchnaged from the default.