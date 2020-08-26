// fill the html skeleton with hthe annotations report once DOM has fully loaded 
// `DOMContentLoaded` event on the document
document.addEventListener('DOMContentLoaded', function () {
  // Before starting getting data from sciwheel we need to know which reference 
  // to query and the authorization token
  // TODO: consider improvements such as:
  // - Pass refId differently (get request params, session, local storage, etc.)
  //   since we do not really need to use storage.sync for that (yes for token)
  //   currently here just for convenience to keep the code short 
  // - improvements to async behaviour and callback handling
  // - module pattern to avoid global vars

  chrome.storage.sync.get(['sciwheelAuthToken', 'sciwheelRefId'], function(result) {
    var sciwheelRefId = result.sciwheelRefId;
    var sciwheelAuthToken = result.sciwheelAuthToken;

    // Error handling, notifying user and return to terminate here
    if (!sciwheelAuthToken) return errorToken();
    if (!sciwheelRefId) return errorRefId();
    if (chrome.runtime.lastError) return errorGeneric();

    // once refId and AuthToken are ready, we can try and get the data
    // TODO: consider using Promise.parallel, maybe a bit faster and fail earlier
    refJsonData = await getRefData(sciwheelRefId, sciwheelAuthToken);
    notesJsonData = await getNotesData(sciwheelRefId, sciwheelAuthToken);
    if (!refJsonData || !notesJsonData) return; // terminate if error above

    // With the data ready, include reports
    includeVisReport(refJsonData, notesJsonData);
    // We can add here other output formats
  });
});

// https://www.tjvantoll.com/2015/09/13/fetch-and-errors/
// https://stackoverflow.com/questions/54163952/async-await-in-fetch-how-to-handle-errors
// https://itnext.io/error-handling-with-async-await-in-js-26c3f20bc06a
// http://thecodebarbarian.com/async-await-error-handling-in-javascript
// https://stackoverflow.com/questions/58815415/how-to-handle-multiple-awaits-in-async-function
// https://stackoverflow.com/questions/46889290/waiting-for-more-than-one-concurrent-await-operation
// https://javascript.info/promise-error-handling


function errorToken() {
  notifyError(
    `It seems you have not provided the Sciwheel authorization token yet.
    Please go to the extension options and follow the instructions to obtain 
    and provide the authorization token to enable this extension to access 
    the data from your Sciwheel account.`
  );
}

function errorRefId() {
  notifyError(
    `Something went wrong getting the reference id! 
    Please try refreshing this page`
  );
}

function errorGeneric(errMsg) {
  notifyError(`Something went wrong! Please try refreshing this page`);
  if (errMsg) notifyError(errMsg);
}

function notifyError(errMsg) {
  document.getElementById("tab_a").innerHTML = errMsg;
}

async function getRefData(sciwheelRefId, sciwheelAuthToken) {
  var urlApiReq =  "/references/" + sciwheelRefId;
  return sciwheelApiCall(urlApiReq, sciwheelAuthToken);
}

async function getNotesData(sciwheelRefId, sciwheelAuthToken) {
  var urlApiReq =  "/references/" + sciwheelRefId + "/notes";
  return sciwheelApiCall(urlApiReq, sciwheelAuthToken);
}

// using async/await for the fetch calls, cleaner code (avoids callbac-hell)
async function sciwheelApiCall(urlApiReq, sciwheelAuthToken) {
  var baseUrl = "https://sciwheel.com/extapi/work";
  var apiCallUrl = baseUrl + "/" + urlApiReq;
  return fetch(apiCallUrl, {
    method: 'get',
    headers: {
      "Authorization": "Bearer " + sciwheelAuthToken,
      "Content-type": "application/json;charset=UTF-8"
    }
  })
    .then(handleApiErrors) // fetch doesn't catch response codes like 401, 500
    .then(response => response.ok ? response.json(): null)
    .catch(err => errorGeneric(err.message));
}

function handleApiErrors(response) {
  switch (response.status) {
    case 200: // Successful request
      break;
    case 401: // Unauthorized: User authorization error (e.g., invalid authorization token), or client has broken the rate limit
      notifyError(`
        We got User authorization error from Sciwheel. Either you have provided
        an invalid authorization token or you have used too much and too quickly
        this extension or other tools that call the Sciwheel API with your 
        token. The later seems unlikely. So go ahead and check the 
        authorization token is up to date.
      `);
      break;
    case 403: // Insufficient privileges for the request
      notifyError(`
        We got Insufficient privileges for the request error from Sciwheel.
        Check your authorization token and try again. If the error persists
        please contact us.
      `);
      break;
    case 500: // Server-related issue. Please contact us if the error persists
      notifyError(`
        We got a Server-related issue from Sciwheel.
        Please try again. If the error persists please contact us.
      `);
      break;
    default: // TODO: if (!response.ok)
      notifyError(`
      We got an undefined error from Sciwheel.
      Please try again. If the error persists please contact us.
    `);
  }
  return response;
}


function includeVisReport(refData, notesData) {

  // refData is an object with reference metadata, incuding 27 fields
  // relevant fields are: 
  // title, abstractText, publishedYear, authorsText, fullTextLink, pdfUrl

  // notesData is an array of comments where each comment has:
  // id, user, comment, highlightText, replies, created, updated, url
  // Ffor now, we are interested in: 
  //     comment (put it as node text, if available, otherwise use highlightText)
  //     highlightText (to put it as tooltip)

  // TODO: perhaps later include replies 
  // TODO: sort the report based on created or updated
  // https://stackoverflow.com/questions/1078118/how-do-i-iterate-over-a-json-structure
  // https://stackoverflow.com/questions/9329446/for-each-over-an-array-in-javascript

  visData = buildVisData(refData, notesData);
  visOptions = getVisOptions();
  var container = document.getElementById('tab_a');
  var network = new vis.Network(container, visData, visOptions);
}

// This is a monster fn that could be better implemented / modularized
function buildVisData(refData, notesData) {
  document.getElementById("tab_b").innerHTML = JSON.stringify(notesData); // just for debugging and trying other tabs

  // We start with the mind map skeleton and we will add comments as nodes
  // skeleton already have nodes for title, objectives, methods, etc. 
  // with short ids such as #t, #o, #m
  var visData = getMindMapSkeleton();

  // We want to start by adding the reference data to the title (main) node
  refData['authorsText'] = refData['authorsText'] || '';
  refData['publishedYear'] = refData['publishedYear'] || '';
  refData['title'] = refData['title'] || '';
  refData['abstractText'] = refData['abstractText'] || '';
  nodeTxt = refData['authorsText'].substring(0, 20) + ' (' + 
              refData['publishedYear'] + ')\n\n' + 
              wordWrap(refData['title'], 35, '\n');
  // We do want a full-text tooltip, but we want it word-wrapped, otherwise it 
  // could be a very long line that overflows horizontally
  tooltip = wordWrap(refData['abstractText'], 50, '<br/>');
 
  visData.nodes.update([{
    id: '#t', label: nodeTxt, title: tooltip, level: 1
  }]);

  for (var val of notesData) {

    document.getElementById("tab_c").innerHTML += '<br/><br/>* Main annotation. Comment: [' + val['comment'] + '] ' + 'Highlight: [' + val['highlightText'] + ']';

    // If there is no comment (either empty string, null or undefined) put it 
    // in highlights using the highlightText as node text
    if((val['comment'] === null && typeof val['comment'] === "object") ||
       (val['comment'] === undefined && typeof val['comment'] === "undefined")||
       (val['comment'] === "" && typeof val['comment'] === "string")) {

      newId = Math.random();
      // We do not want too long labels, so truncate and word-wrap as necessary
      nodeTxt = wordWrap(val['highlightText'], 30, '\n', 80);
      tooltip = wordWrap(val['highlightText'], 50, '<br/>');
      // Finally add the node and edge
      visData.nodes.add([{
        id: newId, label: nodeTxt, title: tooltip, level: 3
      }]);
      visData.edges.add([{from: '#h', to: newId}]);

      document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 40px; display:block>** No comment => add to #h [id:' + newId + ' | label:' + nodeTxt + ' | level:3' + ' | parent:#h' + ']</span>';
    } else {

      if(!val['comment'].includes("#")) { // this means there are no delimiters,
        // only unstructured comment => add it as highlight
        newId = Math.random();
        nodeTxt = wordWrap(val['comment'], 30, '\n');
        tooltip = wordWrap(val['highlightText'], 50, '<br/>');
        // Finally add the node and edge
        visData.nodes.add([{
          id: newId, label: nodeTxt, title: tooltip, level: 3
        }]);
        visData.edges.add([{from: '#h', to: newId}]);

        document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 40px; display:block>** No delimiter, just comment => add to #h [id:' + newId + ' | label:' + nodeTxt + ' | level:3' + ' | parent:#h' + ']</span>';
      } else {

        // Then let's tokenize the comment that has structure
        // We separate the comments using hashtags (#)
        // and filter with arrow function to remove empty tokens
        // So we end up with a flattened array (one element per token, 
        // regardless of the structure indicated by the number of #)
        tokenText = val['comment'].
          split('#').
          map(function(itm){return itm.trim();}).
          filter(item => item); 

        // And to determine the level of each token from the comment, we count 
        // the number of #s that precede it
        tokenLevel = val['comment'].match(/(#)\1*/g) || [];//match sequences of #
        tokenLevel = tokenLevel.map(function(itm){return itm.length;});

        document.getElementById("tab_c").innerHTML += '<br/><br/>Tokenizing ... [levels: ' + tokenLevel + ']';

        var parentId = ['#t'];
        let i = 0;
        for (token_i of tokenText) {

          // We want to generate a hierarchical structure across annotations. 
          // That means we want to match tokens to their respective parents, 
          // either in: 
          // 1. the skeleton, 
          // 2. within the annotation (e.g. #dad ##son1) 
          // 3. across annotations (e.g. if annotation A has #dad ##son1 and 
          //    annotation B has #dad ##son2, the vis should show son1 and son2 
          //    both under dad, not each of them in a different branch)
          // Thus, we want to check if every token matches existing nodes
          // in the visData, either by ID (e.g. to match those in the skeleton), 
          // or by label (e.g. to be able to match across annotations)
          // TODO: check the levels to assign color. Currently there is 
          //       inconsistent behaviour if you match either by id or label
          //       using a different level than the level it aready has
          //       e.g. #hey ##t
          //            #sub ##subsub  ;  #subsub ##wow
          var nodeIds = visData.nodes.map(function(itm){return itm.id;});
          var nodeLabels = visData.nodes.map(function(itm){
            return itm.label.trim().replace(/\n/g, ' ');
          });
          var nodeLevels = visData.nodes.map(function(itm){
            return itm.level;
          });
          // watchout, it may not work because indexof internally uses strict 
          // comparison ===
          var nodeIdIndex = nodeIds.indexOf('#' + token_i); 
          var nodeLabelIndex = nodeLabels.indexOf(token_i);
          var nodeIndex = (nodeIdIndex != -1) ? nodeIdIndex : nodeLabelIndex
          // We will need the id of the existing token, matching the current one
          // If it was a match by id, easy, that is the id
          // But if it matched by label, we need to get the id of that label
          existingNodeId = nodeIds[nodeIndex];
          existingNodeLevel = nodeLevels[nodeIndex];

          var alreadyExists = nodeIdIndex != -1 || nodeLabelIndex != -1;
          var isLeaf = tokenText.indexOf(token_i) === tokenText.length - 1;
          var hasDirectChild = tokenLevel[i] < tokenLevel[i + 1];
          var hasNoChildNoSibling = tokenLevel[i] > tokenLevel[i + 1];
          var hasSibling = tokenLevel[i] == tokenLevel[i + 1];
          // This defines children as those that have exactly one more level
          
          document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 40px; display:block">** Token_i: [' + token_i + ']</span>';
          document.getElementById("tab_c").innerHTML += '<span style="padding-left: 40px; display:block">   nodeIdIndex: [' + nodeIdIndex + '] e.g. has parent by id?</span>';
          document.getElementById("tab_c").innerHTML += '<span style="padding-left: 40px; display:block">   nodeLabelIndex: [' + nodeLabelIndex + '] e.g. has parent by label?</span>';
          document.getElementById("tab_c").innerHTML += '<span style="padding-left: 40px; display:block">   nodeIndex: [' + nodeIndex + ']</span>';
          document.getElementById("tab_c").innerHTML += '<span style="padding-left: 40px; display:block">   existingNodeId: [' + existingNodeId + ']</span>';
          document.getElementById("tab_c").innerHTML += '<span style="padding-left: 40px; display:block">   existingNodeLevel: [' + existingNodeLevel + ']</span>';
          document.getElementById("tab_c").innerHTML += '<span style="padding-left: 40px; display:block">   parentId: [' + parentId + ']</span>';

          if (alreadyExists) { 

            if (hasDirectChild) { 
              parentId.push(existingNodeId);
            } else if (hasNoChildNoSibling) {
              parentId.pop();
            }
            document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 80px; display:block">*** Parent by id exists => push new parent id  [' + token_i + ' - ' + parentId + ']</span>';

            // If current token has no children, add a child to the existing one
            // (e.g. the comment is just #m, then matches the methods node in 
            //  the skeleton but has no further comments -no children-.
            //  this would be useful to quickly add the highlight under the 
            //  methods node)
            if (isLeaf || hasNoChildNoSibling || hasSibling) { 
              nodeTxt = wordWrap(val['highlightText'], 30, '\n', 80);
              tooltip = wordWrap(val['highlightText'], 50, '<br/>');
              newId = Math.random();
              // level 3 'cause it should match most of the time existing 
              // level2 nodes, that is, those in the skeleton and under the #t
              visData.nodes.add([{
                id: newId, label: nodeTxt, title: tooltip, 
                level: existingNodeLevel + 1
              }]);
              visData.edges.add([{from: existingNodeId, to: newId}]); 

              document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 80px; display:block">*** A: I am leaf so add it [id:' + newId + ' | label:' + nodeTxt + ' | level:3' + ' | parent:' + '#' + existingNodeId + ']</span>';
            }
          } else {
            // If does not exists simply add it
            nodeTxt = wordWrap(token_i, 30, '\n');
            tooltip = wordWrap(val['highlightText'], 50, '<br/>');
            newId = Math.random();
            // parent is the last one in the parentId
            // Note that this effectively sets the corresponding parent 
            // even if the level does not match. So the levels are used to 
            // determine whether to add (push) or drop (pop) elements from the 
            // parentsId array
            dadId = parentId[parentId.length - 1]; 
            visData.nodes.add([{
              id: newId, label: nodeTxt, title: tooltip, 
              level: tokenLevel[i] + 1
            }]);
            visData.edges.add([{from: dadId, to: newId}]);
            
            if (hasDirectChild) { 
              parentId.push(newId);
            } else if (hasNoChildNoSibling) {
              parentId.pop();
            }

            document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 80px; display:block">*** D: Normal add? => Add new node  [id:' + newId + ' | label:' + nodeTxt + ' | level:' + (tokenLevel[i] + 1) + ' | parent:' + dadId + ']' + '</span>';
          }

          i++;
        }
      }
    }
  }

  // Set node colors according to the level
  visData.nodes.forEach(function(node_i){
    switch (node_i.level) {
      case 0:
        visData.nodes.update([{id: node_i.id, color:'#7BE141'}]);
        break;
      case 1:
        visData.nodes.update([{id: node_i.id, color:'#7BE141'}]);
        break;
      case 2:
        visData.nodes.update([{id: node_i.id, color:'#FFA807'}]);
        break;
      case 3:
        visData.nodes.update([{id: node_i.id, color:'#97C2FC'}]);
        break;
      case 4:
        visData.nodes.update([{id: node_i.id, color:'#FFFF00'}]);
        break;
      case 5:
        visData.nodes.update([{id: node_i.id, color:'#FB7E81'}]);
        break;
      case 6:
        visData.nodes.update([{id: node_i.id, color:'violet'}]);
        break;
      case 7:
        visData.nodes.update([{id: node_i.id, color:'#C2FABC'}]);
        break;
    }
  });

  document.getElementById("tab_d").innerHTML = JSON.stringify(visData.edges); // pure JS

  // Remove level 1 empty nodes, before creating the network. So remove nodes 
  // in the skeleton that after filling the data, have no children
  var edgesFroms = visData.edges.map(function(itm){return itm.from;});
  if(edgesFroms.indexOf('#b') === -1) visData.nodes.remove({id: '#b'});
  if(edgesFroms.indexOf('#o') === -1) visData.nodes.remove({id: '#o'});
  if(edgesFroms.indexOf('#m') === -1) visData.nodes.remove({id: '#m'});
  if(edgesFroms.indexOf('#r') === -1) visData.nodes.remove({id: '#r'});
  if(edgesFroms.indexOf('#c') === -1) visData.nodes.remove({id: '#c'});
  if(edgesFroms.indexOf('#q') === -1) visData.nodes.remove({id: '#q'});
  if(edgesFroms.indexOf('#h') === -1) visData.nodes.remove({id: '#h'});
  if(edgesFroms.indexOf('#k') === -1) visData.nodes.remove({id: '#k'});
  if(edgesFroms.indexOf('#crossref') === -1) visData.nodes.remove({id: '#crossref'});
  if(edgesFroms.indexOf('#todo') === -1) visData.nodes.remove({id: '#todo'});

  return visData;
}

function getVisOptions() {
  var options = {
    autoResize: true,
    //width: (window.innerWidth - 125) + "px",
    height: (window.innerHeight - 75) + "px",
    nodes:{
      shape: 'box'
    },
    edges: {
      smooth: {
        //forceDirection: 'vertical',
        roundness: 1
      }
    },
    /*layout: {
      randomSeed: 777
    },
    physics: {
      barnesHut: {
        gravitationalConstant: -1500,
        centralGravity: 0.0,
        springLength: 2, 
        avoidOverlap: 0.3
      }
    },
    physics:{
      enabled: true,
      hierarchicalRepulsion: {
        centralGravity: 0.0,
        springLength: 5,
        springConstant: 0.01,
        nodeDistance: 5,
        damping: 0.9
      } 
    },*/
    /*layout:{
      randomSeed: undefined,
      improvedLayout:true,
      hierarchical: {
        enabled:true,
        levelSeparation: 15,
        nodeSpacing: 10,
        treeSpacing: 20,
        blockShifting: true,
        edgeMinimization: true,
        parentCentralization: true,
        direction: 'LR',        // UD, DU, LR, RL
        sortMethod: 'hubsize'   // hubsize, directed
      }
    }/**/
  };
  return options;
}

function getMindMapSkeleton() {

  // create an array with predefined nodes
  var nodes = new vis.DataSet([
    {id: '#t', label: 'Title \n subtitle', level: 1, color: '#7BE141'},
    {id: '#b', label: 'Background', level: 2, color: '#FFA807'},
    {id: '#o', label: 'Objectives', level: 2, color: '#FFA807'},
    {id: '#m', label: 'Methods', level: 2, color: '#FFA807'},
    {id: '#r', label: 'Results', level: 2, color: '#FFA807'},
    {id: '#c', label: 'Conclusions', level: 2, color: '#FFA807'},
    {id: '#q', label: 'Questions / Comments', level: 2, color: '#FFA807'},
    {id: '#h', label: 'Highlights', level: 2, color: '#FFA807'},
    {id: '#k', label: 'Key Messages', level: 2, color: '#FFA807'},
    {id: '#crossref', label: 'Cross-References', level: 2, color: '#FFA807'},
    {id: '#todo', label: 'To Do', level: 2, color: '#FFA807'}
  ]);

  // create an array with predefined edges
  var edges = new vis.DataSet([
    {from: '#t', to: '#b'},
    {from: '#t', to: '#o'},
    {from: '#t', to: '#m'},
    {from: '#t', to: '#r'},
    {from: '#t', to: '#c'},
    {from: '#t', to: '#q'},
    {from: '#t', to: '#h'},
    {from: '#t', to: '#k'},
    {from: '#t', to: '#crossref'},
    {from: '#t', to: '#todo'}
  ]);

  var visData = {
    nodes: nodes,
    edges: edges
  };

  return visData;
}

function wordWrap(rawText, wrapWidth = 50, wrapSeparator = '\n', trunc = -1) {
  var wrapped = rawText || ''; // idiom to prevent errors if it is null
  wrapped = trunc != -1 ? wrapped.substring(0, trunc) + '...' : wrapped; 
  var wrapRegexp = new RegExp(
    '(?![^\\n]{1,' + wrapWidth + '}$)([^\\n]{1,' + wrapWidth + '})\\s', 'g'
  );
  wrapped = wrapped.replace(wrapRegexp, '$1' + wrapSeparator);
  return wrapped;
}

/*

#m
should add 


#r                              
##10 articles                   
###7 infectious diseases       
###3 non-infectious    
##what did we do with that? 
###nothing 
###but maybe something 
####something was 1 
####something was 2





#main ##sub1 ###subsub1
#####AAAAA
#z1 ##x1 ###b1
#a1 ##b1 ###c1
#A ##A.1 ##A.2 ###A.2.1 ###A.2.2 ##A.3

*/

// https://visjs.github.io/vis-network/docs/network/
// https://visjs.github.io/vis-network/examples/
