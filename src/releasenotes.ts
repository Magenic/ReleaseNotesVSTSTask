/// <reference path="typings/index.d.ts" />

import tl = require('vsts-task-lib/task');
import trm = require('vsts-task-lib/toolrunner');
import * as wit from 'vso-node-api/WorkItemTrackingApi';
import vsts = require('vso-node-api');
import fc = require('vso-node-api/FileContainerApi');
import fs = require('fs');
import VSSInterfaces = require('vso-node-api/interfaces/common/VSSInterfaces');
import WorkItemTrackingInterfaces = require('vso-node-api/interfaces/WorkItemTrackingInterfaces');

async function run() {
    try {

        var uri = process.env.SYSTEM_TEAMFOUNDATIONCOLLECTIONURI;
        console.log('Uri: ' + uri);
        var projectId = process.env.SYSTEM_TEAMPROJECT;
        console.log('ProjectId: ' + projectId);
        var buildId = process.env.BUILD_BUILDID;

        var vssEndPoint = tl.getEndpointAuthorization('SystemVssConnection', true);
        var token = vssEndPoint.parameters['AccessToken'];

        let authHandler = vsts.getPersonalAccessTokenHandler(token);

        var connection = new vsts.WebApi(uri, authHandler);

        console.log('connection established');

        var buildRepository = process.env.BUILD_REPOSITORY_LOCALPATH;
        if (typeof buildRepository != 'undefined' && buildRepository) {
            console.log('New Working Directory: ' + buildRepository);
            tl.cd(buildRepository);
        }

        let vstsWit: wit.IWorkItemTrackingApi = connection.getWorkItemTrackingApi();
        console.log('work item interface created.');

        var firstQueryId : string = tl.getInput('firstQueryId', false);
        var updateFirstQuery : boolean = tl.getBoolInput('addBuildNumberToBugsTasksFirstQuery', false);
        var secondQueryId : string = tl.getInput('secondQueryId', false);
        var updateSecondQuery : boolean = tl.getBoolInput('addBuildNumberToBugsTasksSecondQuery', false);
        var thirdQueryId : string = tl.getInput('thirdQueryId', false);
        var updateThirdQuery : boolean = tl.getBoolInput('addBuildNumberToBugsTasksThirdQuery', false);

        var templateFileName = tl.getPathInput('templatefile', true);

        var outputFileName = tl.getPathInput('outputfile', true);

        var data = fs.readFileSync(templateFileName);
        var templateText = data.toString();

        templateText = replaceBuildTokens(templateText, buildId);

        parseQueryResults(firstQueryId, projectId, vstsWit, 'ONE', templateText, buildId, updateFirstQuery).then((value: string) => {
            templateText = value;

            parseQueryResults(secondQueryId, projectId, vstsWit, 'TWO', templateText, buildId, updateSecondQuery).then((value: string) => {
                templateText = value;

                parseQueryResults(thirdQueryId, projectId, vstsWit, 'THREE', templateText, buildId, updateThirdQuery).then((value: string) => {
                    templateText = value;

                    console.log('Template: ' + templateText);

                    fs.writeFileSync(outputFileName, templateText);
                }).catch((reason: any) => {
                    console.log('Error with third query: ' + reason);
                });
            }).catch((reason: any) => {
                console.log('Error with second query: ' + reason);
            });
        }).catch((reason: any) => {
            console.log('Error with first query: ' + reason);
        });
    }
    catch (err) {
        // handle failures in one place
        tl.setResult(tl.TaskResult.Failed, err.message);
    }
}

function replaceBuildTokens(templateText : string, buildId : string) : string {
    templateText = replaceBuildId(templateText, buildId);
    templateText = replaceBuildNumber(templateText);
    templateText = replaceSourceVersion(templateText);
    templateText = replaceSourceBranchName(templateText);
    templateText = replaceRepositoryUri(templateText);
    templateText = replaceBuildUri(templateText);
    templateText = replaceUTCDate(templateText);
    return templateText;
}

function replaceBuildId(templateText : string, buildId : string) : string {
    templateText = templateText.replace('|BUILD_BUILDID|', buildId);
    return templateText;
}

function replaceBuildNumber(templateText : string) : string {
    var buildVariable = process.env.BUILD_BUILDNUMBER;
    templateText = templateText.replace('|BUILD_BUILDNUMBER|', buildVariable);
    return templateText;
}

function replaceSourceVersion(templateText : string) : string {
    var buildVariable = process.env.BUILD_SOURCEVERSION;
    templateText = templateText.replace('|BUILD_SOURCEVERSION|', buildVariable);
    return templateText;
}

function replaceSourceBranchName(templateText : string) : string {
    var buildVariable = process.env.BUILD_SOURCEBRANCHNAME;
    templateText = templateText.replace('|BUILD_SOURCEBRANCHNAME|', buildVariable);
    return templateText;
}

function replaceRepositoryUri(templateText : string) : string {
    var buildVariable = process.env.BUILD_REPOSITORY_URI;
    templateText = templateText.replace('|BUILD_REPOSITORY_URI|', buildVariable);
    return templateText;
}

function replaceBuildUri(templateText : string) : string {
    var buildVariable = process.env.BUILD_BUILDURI;
    templateText = templateText.replace('|BUILD_BUILDURI|', buildVariable);
    return templateText;
}

function replaceUTCDate(templateText : string) : string {
    var buildVariable = (new Date()).toUTCString();;
    templateText = templateText.replace('|CURRENT_DATE_UTC|', buildVariable);
    return templateText;
}

function parseQueryResults(queryId : string, projectId : string, vstsWit : wit.IWorkItemTrackingApi, replacetoken : string, templateText : string, buildId : string, updateQuery : boolean) : Promise<string> {
    let queryPromise = new Promise<string>((resolve, reject) => {

        if (queryId == null || queryId == '') {
            resolve(templateText);
        } else {
            console.log(queryId);

            var context : any = {};
            context.projectId = projectId;
            var results = vstsWit.queryById(queryId, context).then((results : WorkItemTrackingInterfaces.WorkItemQueryResult) => {
                console.log('calling query');
                console.log('result: ' + results);

                var ids : number[];
                var fields : string[] = new Array(2);
                fields[0]='System.WorkItemType';
                fields[1]='System.Title';

                console.log('Result type: ' + results.queryType);

                if (results.queryType == WorkItemTrackingInterfaces.QueryType.Tree || results.queryType == WorkItemTrackingInterfaces.QueryType.OneHop) {
                    console.log('Work Item Results Count: ' + results.workItemRelations.length);
                    if (results.workItemRelations.length > 0) {
                        var sortedList = getRelationsSortedList(results.workItemRelations);
                        console.log('Sorted List Length: ' + sortedList.length);
                        ids = new Array(sortedList.length);
                        var i : number = 0;
                        sortedList.forEach(element => {
                            ids[i] = element.target.id;
                            i++;
                        });
                        console.log('Done creating ids: ' + ids[0]);
                    } else {
                        ids = null;
                    }
                } else {
                    console.log('Work Items Count: ' + results.workItems.length);
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

                var lineTemplate = getReplacementLineTemplate(templateText, replacetoken);
                console.log('Line template: ' + lineTemplate);

                if (ids != null) {
                    console.log('Ready to get individual items, ids found in query');
                    writeQueryResults(ids, fields, vstsWit, lineTemplate, replacetoken, buildId, updateQuery).then((returnedText : string) => {
                        console.log('Returned text: ' + returnedText);
                        templateText = templateText.replace(lineTemplate, returnedText);
                        resolve(templateText);
                    });
                } else {

                    templateText = templateText.replace(lineTemplate, "");
                    resolve(templateText);
                }
            }).catch((reason : any) => {
                console.log(reason);
                reject('Task failed: ' + reason);
            });
        }
    });
    return queryPromise;
}

function getRelationsSortedList(targetList : WorkItemTrackingInterfaces.WorkItemLink[]) : WorkItemTrackingInterfaces.WorkItemLink[] {
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

function writeQueryResults(ids : number[], fields : string[], vstsWit : wit.IWorkItemTrackingApi, lineTemplate : string, replacetoken : string, buildId : string, updateQuery : boolean) : Promise<string> {
    let resultPromise = new Promise<string>((resolve, reject) => {
        var idsSubset : number[];
        var subArrayCount : number = 0;
        var promises = [];

        for (var currentPosition : number = 0; currentPosition < ids.length; currentPosition++) {
          if (subArrayCount == 0) {
            if (ids.length - currentPosition >= 50) {
              idsSubset = new Array(50);
            } else {
              idsSubset = new Array(ids.length - currentPosition)
            }
          }

          idsSubset[subArrayCount] = ids[currentPosition];

          if (subArrayCount == idsSubset.length - 1) {
            promises.push(getSubQuery(idsSubset, fields, vstsWit, lineTemplate, replacetoken, buildId, updateQuery));
            subArrayCount = 0;
          } else {
              subArrayCount ++;
          }
        }

        Promise.all(promises)
        .then((results) => {
          console.log("All query fetches done", results);
          var replacementText : string = "";
          results.forEach(element => {
            replacementText += element;
          });
          resolve(replacementText);
        })
        .catch((reason: any) => {
            console.log('Error waiting for all queiry items to return: ' + reason);
        });
    });
    return resultPromise;
}

function getSubQuery(idsSubset : number[], fields : string[], vstsWit : wit.IWorkItemTrackingApi, lineTemplate : string, replacetoken : string, buildId : string, updateQuery : boolean) : Promise<string> {
    let resultPromise = new Promise<string>((resolve, reject) => {
        vstsWit.getWorkItems(idsSubset, fields).then((returnItems : WorkItemTrackingInterfaces.WorkItem[]) => {

            console.log('Items Found: ' + returnItems.length);
            var sortedItems : WorkItemTrackingInterfaces.WorkItem[] = new Array(returnItems.length);
            var position: number = 0;
            idsSubset.forEach(element => {
                sortedItems[position] = returnItems.find(function(x){return x.id == element;});
                position ++;
            });

            console.log('Completed finding sorted items, count: ' + sortedItems.length);
            var replacementText : string = "";
            lineTemplate = stripBeginEndtemplateTags(lineTemplate, replacetoken);

            sortedItems.forEach(element => {
                replacementText = writeLine(replacementText, replacetoken, lineTemplate, element);

                var workItemType : string = element.fields['System.WorkItemType'];
                if (updateQuery && (workItemType == 'Bug' || workItemType == 'Task')) {
                // Fire and forget these updates
                    var patch : any = {};
                    patch = JSON.parse('[{"op": "add","path": "/fields/Microsoft.VSTS.Build.IntegrationBuild", "value": "' + buildId + '"}]');
                    vstsWit.updateWorkItem(null, patch, element.id).then((value : WorkItemTrackingInterfaces.WorkItem) => {
                        console.log('Work item: ' + element.id + ' updated');
                    }).catch((reason : any) => {
                        console.log('Error updating work item: ' + reason);
                    });
                }
            });
            resolve(replacementText);
        }).catch((reason : any) => {
            console.log('Error retrieving individual query items: ' + reason);
            reject(reason);
        });
    });
    return resultPromise;
}

function writeLine(replacementText : string, replacetoken : string, lineTemplate: string, element : WorkItemTrackingInterfaces.WorkItem) : string {
    var idToken : string = '|DETAIL_ID_' + replacetoken + '|';
    var typeToken : string = '|DETAIL_TYPE_' + replacetoken + '|';
    var nameToken : string = '|DETAIL_NAME_' + replacetoken + '|';

    lineTemplate = lineTemplate.replace(idToken, element.id.toString());
    lineTemplate = lineTemplate.replace(typeToken, element.fields['System.WorkItemType']);
    lineTemplate = lineTemplate.replace(nameToken, element.fields['System.Title']);

    replacementText = replacementText.concat(lineTemplate);
    return replacementText;
}

function getReplacementLineTemplate(templateText : string, replacetoken: string) : string {
    var lineStartToken : string = getLineStartTag(replacetoken);
    var lineEndToken : string = getLineEndTag(replacetoken);

    var positionStart : number = templateText.indexOf(lineStartToken);
    var positionEnd : number = templateText.indexOf(lineEndToken, positionStart);

    if (positionStart >= 0 && positionEnd < 0) {
        throw new Error('Start token ' + lineStartToken + ' found with no end token after it.');
    }

    var length : number = (positionEnd + lineEndToken.length) - positionStart;

    return templateText.substr(positionStart, length);
}

function stripBeginEndtemplateTags(templateText : string, replacetoken: string) : string {
    var lineStartToken : string = getLineStartTag(replacetoken);
    var lineEndToken : string = getLineEndTag(replacetoken);
    var returnText : string = "";

    returnText = templateText.replace(lineStartToken, "");
    console.log('Line Template Text: ' + returnText.replace(lineEndToken, ""));
    return returnText.replace(lineEndToken, "");
}

function getLineStartTag(replacetoken: string) : string {
    return '|START_DETAIL_LINE_' + replacetoken + '|';
}

function getLineEndTag(replacetoken: string) : string {
    return '|END_DETAIL_LINE_' + replacetoken + '|';
}

run();
