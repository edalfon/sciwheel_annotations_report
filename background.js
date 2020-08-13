// We want to use chrome.pageAction to add a clickable extension button
// to generate the annotations report
//
// https://developer.chrome.com/extensions/pageAction
// Use the chrome.pageAction API to put icons in the main Google Chrome 
// toolbar, to the right of the address bar. Page actions represent actions 
// that can be taken on the current page, but that aren't applicable to all 
// pages. Page actions appear grayed out when inactive.

// The button should only be enabled when the current tab is on a specific item
// from your schiweel library, either in the detail view or in the pdf view.
// URLs for those two cases are formed as follows: 
// https://sciwheel.com/work/#/items/9357944/detail
// https://sciwheel.com/work/item/9357944/resources/9099136/pdf
// (did not find documentation for this just what you can see browsing sciwheel)

function getSciwheelRefId(tabUrl) {
  refIdDetailView = tabUrl.match('(sciwheel.com/work/#/items/)(\\d+)');
  refIdPdfView = tabUrl.match('(sciwheel.com/work/item/)(\\d+)');
  // Matches either of those formats, or returns null
  refId = refIdDetailView ?? refIdPdfView; // Nullish coalescing operator
  refId = refId ? refId[2] : refId; // id are the numbers in the second group
  console.log(tabUrl)
  console.log(refId)
  return refId;
}

function onWebNav(details) {

  sciwheelRefId = getSciwheelRefId(details.url)
  if (sciwheelRefId) { 
    chrome.pageAction.show(details.tabId);
  } else {
    chrome.pageAction.hide(details.tabId);
  }

  /* Old implementation that I did not properly document at the time
     but now with fresh eyes seems unnecessarily convoluted
  var refIndex = details.url.indexOf('#');
  var ref = refIndex >= 0 ? details.url.slice(refIndex + 1) : '';
  if ( (ref.indexOf('/items/') != -1 && ref.match('/\\d+') != null) || 
        details.url.match('/work/item/\\d+') != null) { 
    chrome.pageAction.show(details.tabId);
  } else {
    chrome.pageAction.hide(details.tabId);
  }
  */
}



// Base filter to enable the extension button only con sciwheel.com pages
var filter = {
  url: [{
    hostEquals: 'sciwheel.com'
  }]
};
chrome.webNavigation.onCommitted.addListener(onWebNav, filter);
chrome.webNavigation.onHistoryStateUpdated.addListener(onWebNav, filter);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(onWebNav, filter);

// Want to enable/disable the extension button when tab changes so need to use
// onActivated event, to monitor when tab changes 
// https://developer.chrome.com/extensions/tabs#event-onActivated
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    tab.tabId = tab.id
    onWebNav(tab)
  });
});

chrome.pageAction.onClicked.addListener(function(activeTab) {

  var sciwheelRefId = getSciwheelRefId(activeTab.url)

  chrome.storage.sync.set({'sciwheelRefId': sciwheelRefId}, function() {
    // Notify that we saved.
    //message('Settings saved');
  });

  var sciwheelAuthToken = '560ED7B3E32586E1FAC3672088EA049E';
  chrome.storage.sync.set({'sciwheelAuthToken': sciwheelAuthToken}, function() {
    // Notify that we saved.
    //message('Settings saved');
  });

  // get ref id
  // get token
  
  var newURL = "annotations_report.html" + "?sciwheelRefId=" + sciwheelRefId;
  chrome.tabs.create({ url: newURL });

});

