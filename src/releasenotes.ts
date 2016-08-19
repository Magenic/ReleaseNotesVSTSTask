/// <reference path="typings/index.d.ts" />

import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');
import * as wit from 'vso-node-api/WorkItemTrackingApi';
import vsts = require('vso-node-api');
import fc = require('vso-node-api/FileContainerApi');
import fs = require('fs');
import VSSInterfaces = require("vso-node-api/interfaces/common/VSSInterfaces");
import WorkItemTrackingInterfaces = require("vso-node-api/interfaces/WorkItemTrackingInterfaces");

async function run() {
    try {


        var uri = process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI;
        console.log('Uri: ' + uri);
        var projectId = process.env.SYSTEM_TEAMPROJECT;
        console.log('ProjectId: ' + projectId);
        var buildId = process.env.BUILD_BUILDID;

        var vssEndPoint = tl.getEndpointAuthorization("SystemVssConnection", true);
        var token = vssEndPoint.parameters['AccessToken'];

        let authHandler = vsts.getPersonalAccessTokenHandler(token); 
        
        var connection = new vsts.WebApi(uri, authHandler); 

        console.log("connection established");

        let vstsWit: wit.IWorkItemTrackingApi = connection.getWorkItemTrackingApi();
        console.log("work item interface created.");

        var firstQueryId : string = tl.getInput('firstQueryId', false);
        var updateFirstQuery : boolean = tl.getBoolInput("addBuildNumberToBugsTasksFirstQuery", false);
        var secondQueryId : string = tl.getInput('secondQueryId', false);
        var updateSecondQuery : boolean = tl.getBoolInput("addBuildNumberToBugsTasksSecondQuery", false);
        var thirdQueryId : string = tl.getInput('thirdQueryId', false);
        var updateThirdQuery : boolean = tl.getBoolInput("addBuildNumberToBugsTasksThirdQuery", false);

        var templateFileName = tl.getPathInput('templatefile', true);

        var outputFileName = tl.getPathInput('outputfile', true);

        var data = fs.readFileSync(templateFileName);
        var templateText = data.toString();

        templateText = ReplaceBuildTokens(templateText, buildId);

        ParseQueryResults(firstQueryId, projectId, vstsWit, "|BUILD_QUERY_ONE|", templateText, buildId, updateFirstQuery).then((value: string) => {
            templateText = value;

            ParseQueryResults(secondQueryId, projectId, vstsWit, "|BUILD_QUERY_TWO|", templateText, buildId, updateSecondQuery).then((value: string) => {
                templateText = value;

                ParseQueryResults(thirdQueryId, projectId, vstsWit, "|BUILD_QUERY_THREE|", templateText, buildId, updateThirdQuery).then((value: string) => {
                    templateText = value;

                    console.log("Template: " + templateText);

                    fs.writeFileSync(outputFileName, templateText);
                }).catch((reason: any) => {
                    console.log("Error with third query: " + reason);
                });
            }).catch((reason: any) => {
                console.log("Error with second query: " + reason);
            });
        }).catch((reason: any) => {
            console.log("Error with first query: " + reason);
        });
    }
    catch (err) {
        // handle failures in one place
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

function ReplaceBuildTokens(templateText : string, buildId : string) : string {
    templateText = ReplaceBuildId(templateText, buildId);
    templateText = ReplaceBuildNumber(templateText);
    templateText = ReplaceSourceVersion(templateText);
    templateText = ReplaceSourceBranchName(templateText);
    templateText = ReplaceRepositoryUri(templateText);
    templateText = ReplaceBuildUri(templateText);
    templateText = ReplaceUTCDate(templateText);
    return templateText;
}

function ReplaceBuildId(templateText : string, buildId : string) : string {
    templateText = templateText.replace("|BUILD_BUILDID|", buildId);
    return templateText;
}

function ReplaceBuildNumber(templateText : string) : string {
    var buildVariable = process.env.BUILD_BUILDNUMBER;
    templateText = templateText.replace("|BUILD_BUILDNUMBER|", buildVariable);
    return templateText;
}

function ReplaceSourceVersion(templateText : string) : string {
    var buildVariable = process.env.BUILD_SOURCEVERSION;
    templateText = templateText.replace("|BUILD_SOURCEVERSION|", buildVariable);
    return templateText;
}

function ReplaceSourceBranchName(templateText : string) : string {
    var buildVariable = process.env.BUILD_SOURCEBRANCHNAME;
    templateText = templateText.replace("|BUILD_SOURCEBRANCHNAME|", buildVariable);
    return templateText;
}

function ReplaceRepositoryUri(templateText : string) : string {
    var buildVariable = process.env.BUILD_REPOSITORY_URI;
    templateText = templateText.replace("|BUILD_REPOSITORY_URI|", buildVariable);
    return templateText;
}

function ReplaceBuildUri(templateText : string) : string {
    var buildVariable = process.env.BUILD_BUILDURI;
    templateText = templateText.replace("|BUILD_BUILDURI|", buildVariable);
    return templateText;
}

function ReplaceUTCDate(templateText : string) : string {
    var buildVariable = (new Date()).toUTCString();;
    templateText = templateText.replace("|CURRENT_DATE_UTC|", buildVariable);
    return templateText;
}

function ParseQueryResults(queryId : string, projectId : string, vstsWit : wit.IWorkItemTrackingApi, replacetoken : string, templateText : string, buildId : string, updateQuery : boolean) : Promise<string> {
    let queryPromise = new Promise<string>((resolve, reject) => {
       
        if (queryId == null || queryId == '') {
            resolve(templateText);
        }
        else
        {
            console.log(queryId);

            var replacementText : string = "";
            var context : any = {};
            context.projectId = projectId;
            var results = vstsWit.queryById(queryId, context).then((results : WorkItemTrackingInterfaces.WorkItemQueryResult) => {
                console.log('calling query');
                console.log("result: " + results);

                replacementText = WriteHeader(replacementText);

                var ids : number[];
                var fields : string[] = new Array(2);
                fields[0]="System.WorkItemType";
                fields[1]="System.Title";

                console.log("Result type: " + results.queryType);

                if (results.queryType == WorkItemTrackingInterfaces.QueryType.Tree || results.queryType == WorkItemTrackingInterfaces.QueryType.OneHop) {
                    console.log("Work Item Results Count: " + results.workItemRelations.length);
                    if (results.workItemRelations.length > 0) {
                        var sortedList = GetRelationsSortedList(results.workItemRelations);
                        console.log("Sorted List Length: " + sortedList.length);
                        ids = new Array(sortedList.length);
                        var i : number = 0;
                        sortedList.forEach(element => {
                            ids[i] = element.target.id;
                            i++;
                        });
                        console.log("Done creating ids: " + ids[0]);
                    } else {
                        ids = null;
                    }
                } else {
                    console.log("Work Items Count: " + results.workItems.length);
                    if (results.workItems.length > 0) {
                        ids = new Array(results.workItems.length);
                        var i : number = 0;
                        results.workItems.forEach(element => {
                            ids[i] = element.id;
                            i++;
                        });
                    } else {
                        ids = null;
                    }
                }

                if (ids != null) {
                    console.log("Ready to get individual items, ids found in query");
                    WriteQueryResults(ids, fields, vstsWit, replacementText, buildId, updateQuery).then((returnedText : string) => {
                        replacementText = returnedText;
                        replacementText = WriteFooter(replacementText);

                        templateText = templateText.replace(replacetoken, replacementText);
                        resolve(templateText);
                    });
                } else {
                    replacementText = WriteFooter(replacementText);

                    templateText = templateText.replace(replacetoken, replacementText);
                    resolve(templateText);
                }
            }).catch((reason : any) => {
                console.log(reason);
                reject("Task failed: " + reason);
            });
        }
    });
    return queryPromise;
}

function GetRelationsSortedList(targetList : WorkItemTrackingInterfaces.WorkItemLink[]) : WorkItemTrackingInterfaces.WorkItemLink[] {
    var returnList : WorkItemTrackingInterfaces.WorkItemLink[] = new Array(targetList.length);
    var position : number = 0;

    var parentList = targetList.filter(function(x){return x.source==null})

    targetList.forEach(element => {
        if (parentList.find(function(x){return x.target.id == element.target.id;})) {
            returnList[position] = element;
            position ++;
            position = AddChildrenToElement(returnList, element, targetList, position);
        }
    });
    return returnList;
}

function AddChildrenToElement(returnList : WorkItemTrackingInterfaces.WorkItemLink[], parentElement : WorkItemTrackingInterfaces.WorkItemLink, targetList : WorkItemTrackingInterfaces.WorkItemLink[], position : number) : number {
    var returnPosition : number = position;
    targetList.forEach(element => {
        if (element.source != null && element.source.id == parentElement.target.id) {
            returnList[returnPosition] = element;
            returnPosition ++;
            returnPosition = AddChildrenToElement(returnList, element, targetList, returnPosition);
        }
    });
    return returnPosition;
}

function WriteQueryResults(ids : number[], fields : string[], vstsWit : wit.IWorkItemTrackingApi, replacementText : string, buildId : string, updateQuery : boolean) : Promise<string> {
    let resultPromise = new Promise<string>((resolve, reject) => {
        vstsWit.getWorkItems(ids, fields).then((returnItems : WorkItemTrackingInterfaces.WorkItem[]) => {
            
            var sortedItems : WorkItemTrackingInterfaces.WorkItem[] = new Array(returnItems.length);
            var position: number = 0;
            ids.forEach(element => {
                sortedItems[position] = returnItems.find(function(x){return x.id == element;});
                position ++;
            });

            sortedItems.forEach(element => {
                var workItemType = element.fields['System.WorkItemType'];
                replacementText = replacementText.concat("<tr><td>", element.id.toString(), "</td><td>", element.fields['System.Title'], "<td><td>", workItemType, "</td></tr>");

                if (updateQuery && (workItemType == "Bug" || workItemType == "Task")) {
                // Fire and forget these updates
                    var patch : any = {};
                    patch = JSON.parse('[{"op": "add","path": "/fields/Microsoft.VSTS.Build.IntegrationBuild", "value": "' + buildId + '"}]');
                    vstsWit.updateWorkItem(null, patch, element.id).then((value : WorkItemTrackingInterfaces.WorkItem) => {
                        console.log("Work item: " + element.id + " updated");
                    }).catch((reason : any) => {
                        console.log("Error updating work item: " + reason);
                    });
                }
            });
            resolve(replacementText);
        }).catch((reason : any) => {
            console.log("Error retrieving individual query items: " + reason);
        });
    });
    return resultPromise;
}

function WriteHeader(replacementText : string) : string {
    replacementText = replacementText.concat("<table><tr><th>Id</th><th>Type</th><th>Name</th></tr>");
    return replacementText;
}

function WriteFooter(replacementText : string) : string {
    replacementText = replacementText.concat("</table>");
    return replacementText;
}

run();