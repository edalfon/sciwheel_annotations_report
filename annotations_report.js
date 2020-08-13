// Add event listeners once the DOM has fully loaded by listening for the
// `DOMContentLoaded` event on the document, and adding your listeners to
// specific elements when it triggers.
document.addEventListener('DOMContentLoaded', function () {

  // Before starting getting data from sciwheel we need to know which reference to query and the authorization token
  // TODO: check how to do it better considering:
  //       - async behaviour (can happen that we try to get the value, 
  //         and it is not already set and/or that we get the value and 
  //         continue rendering the page, which assumes we got the value, 
  //         by the get async has not responded yet) and
  //       - module pattern to avoid the global vars
  chrome.storage.sync.get(['sciwheelAuthToken', 'sciwheelRefId'], function(result) {
    var sciwheelRefId = result.sciwheelRefId;
    var sciwheelAuthToken = result.sciwheelAuthToken;
    // once refId and AuthToken are ready
    buildAnnotationReports(sciwheelRefId, sciwheelAuthToken);
  });
});

// new version using async/await for the fetch calls, 
// which leads to a much cleaner code (avoids callback hell)
async function buildAnnotationReports(sciwheelRefId, sciwheelAuthToken) {

  // We need to fetch requests, one for the details of the reference
  // and one for the notes
  let commentsResponse = await fetch("https://sciwheel.com/extapi/work/references/" + sciwheelRefId + "/notes", {
    method: 'get',
    headers: {
      "Authorization": "Bearer " + sciwheelAuthToken,
      "Content-type": "application/json;charset=UTF-8"
    }
  }).catch(function (error) {
    // TODO: real error handling
    document.getElementById("tab_d").innerHTML = "ERROR !!!"; // pure JS
  });
  let commentsJsonData = await commentsResponse.json();

  let refResponse = await fetch("https://sciwheel.com/extapi/work/references/" + sciwheelRefId, {
    method: 'get',
    headers: {
      "Authorization": "Bearer " + sciwheelAuthToken,
      "Content-type": "application/json;charset=UTF-8"
    }
  }).catch(function (error) {
    // TODO: real error handling
    document.getElementById("tab_d").innerHTML = "ERROR !!!"; // pure JS
  });
  let refJsonData = await refResponse.json();

  buildVisReport(refJsonData, commentsJsonData);
  // We can add here other output formats
}

// OLD version using callbacks, which can lead to callback hell 
function buildAnnotationReports_old() {

  // Initialization work goes here
  fetch("https://sciwheel.com/extapi/work/references/" + sciwheelRefId + "/notes", {
    method: 'get',
    headers: {
      "Authorization": "Bearer " + sciwheelAuthToken,
      "Content-type": "application/json;charset=UTF-8"
    }
  })
  .then(res => res.json())
  .then(function (data) {
    buildReport(data);
  })
  .catch(function (error) {
    console.log('Request failed', error);
  });
};


function buildVisReport(refData, commentsData) {

  // refData is an object with reference metadata, incuding 27 fields
  // relevant fields are: title, abstractText, publishedYear, authorsText, fullTextLink, pdfUrl

  // commentsData is an array of comments
  // each comment has an id, user, comment, highlightText, replies, created, updated, url
  // for now, we are interested in: 
  //     comment (to put it as node text, when available, otherwise put highlightText) and 
  //     highlightText (to put it as tooltip)
  // TODO: perhaps later include replies using a recursive fn
  // TODO: sort the report based on created or updated

  // https://stackoverflow.com/questions/1078118/how-do-i-iterate-over-a-json-structure
  // https://stackoverflow.com/questions/9329446/for-each-over-an-array-in-javascript


  document.getElementById("tab_b").innerHTML = JSON.stringify(commentsData); // pure JS

  var visData = getMindMapSkeleton();

  // We do not want too long labels, so truncate them and word-wrap them
  refData['authorsText'] = refData['authorsText'] || '';
  refData['publishedYear'] = refData['publishedYear'] || '';
  refData['title'] = refData['title'] || '';
  refData['abstractText'] = refData['abstractText'] || '';
  labelText = refData['authorsText'].substring(0, 20) + ' (' + 
              refData['publishedYear'] + ')\n\n' + 
              wordWrap(refData['title'], 35, '\n');
  // We do want to full tooltip, but we want it word-wrapped it
  //titleText = refData['abstractText'].replace(/(?![^\n]{1,50}$)([^\n]{1,50})\s/g, '$1<br/>');
  titleText = wordWrap(refData['abstractText'], 50, '<br/>');
 
  visData.nodes.update([{id: '#t', label: labelText, title: titleText, level: 1}]);

  for (var val of commentsData) {

    document.getElementById("tab_c").innerHTML += '<br/><br/>* Main annotation. Comment: [' + val['comment'] + '] ' + 'Highlight: [' + val['highlightText'] + ']';

    // If there is no comment (either empty string, null or undefined) put it in highlights
    // using the highlightText as node text
    if( (val['comment'] === null && typeof val['comment'] === "object") ||
        (val['comment'] === "" && typeof val['comment'] === "string") ||
        (val['comment'] === undefined && typeof val['comment'] === "undefined") ) {

      newId = Math.random();
      // We do not want too long labels, so truncate them and word-wrap them as necessary
      labelText = wordWrap(val['highlightText'], 30, '\n', 80);
      titleText = wordWrap(val['highlightText'], 50, '<br/>');
      // Finally add the node and edge
      visData.nodes.add([{id: newId, label: labelText, title: titleText, level: 3}]);
      visData.edges.add([{from: '#h', to: newId}]);

      document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 40px; display:block>** No comment => add to #h [id:' + newId + ' | label:' + labelText + ' | level:3' + ' | parent:#h' + ']</span>';
      
    } else {

      // We separate the comments using hashtags (#)
      valTokens = val['comment'].split('#').map(function(itm){return itm.trim();}).filter(item => item); //filter using ES6 arrow function to remove empty tokens
      // And we determine the level of the comment, given the number of #, so count them
      valLevels = val['comment'].match(/(#)\1*/g)||[];
      valLevels = valLevels.map(function(itm){return itm.length;});

      document.getElementById("tab_c").innerHTML += '<br/><br/>Tokenizing ... [levels: ' + valLevels + ']';

      if(valLevels.length === 0) { // this means there are no # delimiters, only an unstructured comment

        newId = Math.random();
        // We do not want too long labels, so truncate them and word-wrap them as necessary
        labelText = wordWrap(val['comment'], 30, '\n');
        titleText = wordWrap(val['highlightText'], 50, '<br/>');
        // Finally add the node and edge
        visData.nodes.add([{id: newId, label: labelText, title: titleText, level: 3}]);
        visData.edges.add([{from: '#h', to: newId}]);

        document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 40px; display:block>** No delimiter, just comment => add to #h [id:' + newId + ' | label:' + labelText + ' | level:3' + ' | parent:#h' + ']</span>';

      } else {

        //check length are the same
        var parentId = ['#t'];
        let i = 0;
        for (token_i of valTokens) {

          var nodeIds = visData.nodes.map(function(itm){return itm.id;});
          var nodeLabels = visData.nodes.map(function(itm){return itm.label.trim().replace(/\n/g, ' ');});
          var nodeIdIndex = nodeIds.indexOf('#' + token_i); //does not work cause indexo internally use strict comparison ===
          var nodeLabelIndex = nodeLabels.indexOf(token_i);
          //var toy = '#' + token_i;
          //var nodeIdIndex = nodeIds.findIndex(function(itm){return itm == toy;}); // 3
          //var nodeLabelIndex = nodeLabels.findIndex(itm => itm == 'hard to identify relevant alternatives');

          document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 40px; display:block">** Token_i: [' + token_i + ']</span>';
          document.getElementById("tab_c").innerHTML += '<span style="padding-left: 40px; display:block">nodeIdIndex: [' + nodeIdIndex + '] e.g. has parent by id?</span>';
          document.getElementById("tab_c").innerHTML += '<span style="padding-left: 40px; display:block">nodeLabelIndex: [' + nodeLabelIndex + '] e.g. has parent by label?</span>';

          if (nodeIdIndex != -1) { // if exists id, push to parentId, always level 3 'cause it matches only existing level2 nodes
            parentId.push(('#' + token_i)); 
            document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 80px; display:block">*** Parent by id exists => push new parent id  [' + token_i + ' - ' + parentId + ']</span>';
            if (valTokens.indexOf(token_i) === valTokens.length - 1 || valLevels[i] != valLevels[i + 1] - 1) { // If the token has no children, then simply add it

              // We do not want too long labels, so truncate them and word-wrap them as necessary
              labelText = wordWrap(val['highlightText'], 30, '\n', 80);
              titleText = wordWrap(val['highlightText'], 50, '<br/>');
              // Finally add the node and edge
              newId = Math.random();
              visData.nodes.add([{id: newId, label: labelText, title: titleText, level: 3}]);
              visData.edges.add([{from: '#' + token_i, to: newId}]);                
              document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 80px; display:block">*** A: I am leaf so add it [id:' + newId + ' | label:' + labelText + ' | level:3' + ' | parent:' + '#' + token_i + ']</span>';
            }

          } else if (nodeLabelIndex != -1) { // if exists label, push to parentId (matching id for the label)
            parentId.push(nodeIds[nodeLabelIndex]);
            document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 80px; display:block">*** Parent by label exists => push new parent id  [' + token_i + ' - ' + parentId + ']</span>';
            if (valTokens.indexOf(token_i) === valTokens.length - 1 || valLevels[i] != valLevels[i + 1] - 1) {

              // We do not want too long labels, so truncate them and word-wrap them as necessary
              labelText = wordWrap(val['highlightText'], 30, '\n', 80);
              titleText = wordWrap(val['highlightText'], 50, '<br/>');
              // Why was I doing this?
              //visData.nodes.update([{id: nodeIds[nodeLabelIndex], title: titleText}]); //TODO: append to title, instead of replace
              // Finally add the node and edge
              newId = Math.random();
              visData.nodes.add([{id: newId, label: labelText, title: titleText, level: valLevels[i] + 2}]);
              visData.edges.add([{from: nodeIds[nodeLabelIndex], to: newId}]);                
              document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 80px; display:block">**** B: Is leaf? => Add new node  [id:' + newId + ' | label:' + labelText + ' | level:' + valLevels[i] + 2 + ' | parent:' + nodeIds[nodeLabelIndex] + ']</span>';
            }

          } else if (valLevels[i] === 1 && valLevels[i] != valLevels[i + 1] - 1) {

            // We do not want too long labels, so truncate them and word-wrap them as necessary
            labelText = wordWrap(token_i, 30, '\n');
            titleText = wordWrap(val['highlightText'], 50, '<br/>');
            // Finally add the node and edge
            newId = Math.random();
            visData.nodes.add([{id: newId, label: labelText, title: '', level: 2}]);
            visData.edges.add([{from: parentId[valLevels[i] - 1], to: newId}]);                
            parentId.push(newId);

            // We do not want too long labels, so truncate them and word-wrap them as necessary
            labelText = wordWrap(val['highlightText'], 30, '\n', 80);
            titleText = wordWrap(val['highlightText'], 50, '<br/>');
            // Finally add the node and edge
            newIdChild = Math.random();
            visData.nodes.add([{id: newIdChild, label: labelText, title: titleText, level: 3}]);
            visData.edges.add([{from: newId, to: newIdChild}]);                
            parentId.push(newIdChild);

            document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 80px; display:block">*** C: To level 1 add => Add new node  [id:' + newId + ' | label:' + labelText + ' | level:' + valLevels[i] + 1 + ' | parent:2' + ']' + '</span>';
              
          } else {
            // We do not want too long labels, so truncate them and word-wrap them as necessary
            labelText = wordWrap(token_i, 30, '\n');
            titleText = wordWrap(val['highlightText'], 50, '<br/>');
            // Finally add the node and edge
            newId = Math.random();
            visData.nodes.add([{id: newId, label: labelText, title: titleText, level: valLevels[i] + 1}]);
            visData.edges.add([{from: parentId[valLevels[i] - 1], to: newId}]);                
            parentId.push(newId);

            document.getElementById("tab_c").innerHTML += '<br/><br/><span style="padding-left: 80px; display:block">*** D: Normal add? => Add new node  [id:' + newId + ' | label:' + labelText + ' | level:' + valLevels[i] + 1 + ' | parent:' + parentId[valLevels[i] - 1] + ']' + '</span>';
          }

          //document.getElementById("tab_d").innerHTML = document.getElementById("tab_d").innerHTML + '<br/><br/>' + (i + ': ' + token_i); // pure JS
          //document.getElementById("tab_d").innerHTML = document.getElementById("tab_d").innerHTML + '<br/><br/>' + nodeIds + '<br/>' + toy + ': ' + nodeIdIndex; // pure JS
          i++;
        }
      }
    }
  }

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

  
  //    {id: 3, label: 'node\nthree', shape: 'diamond', color:'#FB7E81'},
  //    {id: 5, label: 'node\nfive', shape: 'ellipse', color:'#6E6EFD'},
  //    {id: 8, label: 'node\neight', shape: 'triangleDown', color:'#6E6EFD'}


  // create a network
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
  document.getElementById("tab_d").innerHTML = JSON.stringify(visData); // pure JS

  // Remove level 1 empty nodes, before creating the network
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

  var container = document.getElementById('tab_a');
  var network = new vis.Network(container, visData, options);
}

function getMindMapSkeleton() {

  // create an array with nodes
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
    {id: '#crossref', label: 'crossref', level: 2, color: '#FFA807'},
    {id: '#todo', label: 'To Do', level: 2, color: '#FFA807'}
  ]);

  // create an array with edges
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
  var wrappedText = rawText || ''; // idiom to validate and or prevent errors
  wrappedText = (trunc != -1) ? wrappedText.substring(0, trunc) + '...' : wrappedText; //truncate if needed
  var wrapRegexp = new RegExp('(?![^\\n]{1,' + wrapWidth + '}$)([^\\n]{1,' + wrapWidth + '})\\s', 'g');
  wrappedText = wrappedText.replace(wrapRegexp, '$1' + wrapSeparator);
  return wrappedText;
}

