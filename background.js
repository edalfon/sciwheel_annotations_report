/*
  We want to use chrome.pageAction to add a clickable extension button
  to generate the annotations report

  https://developer.chrome.com/extensions/pageAction
  "Use the chrome.pageAction API to put icons in the main Google Chrome 
  toolbar, to the right of the address bar. Page actions represent actions 
  that can be taken on the current page, but that aren't applicable to all 
  pages. Page actions appear grayed out when inactive."

  The button should only be enabled when the current tab is on a specific item
  from your schiweel library, either in the detail view or in the pdf view.
  URLs for those two cases are formed as follows: 
  https://sciwheel.com/work/#/items/9357944/detail
  https://sciwheel.com/work/item/9357944/resources/9099136/pdf
  (did not find documentation for this just what you can see browsing sciwheel)
*/

/*
  I guess the standard way to do it would be to use the declarativeContent API
  
  https://developer.chrome.com/extensions/declarativeContent
  "The Declarative Content API allows you to show your extension's page action 
  depending on the URL of a web page"
  Pretty straightforward examples like this "Page action by URL" do it
  https://developer.chrome.com/extensions/samples#search
  https://developer.chrome.com/extensions/examples/api/pageAction/pageaction_by_url.zip

  However, in the detail view of the reference in Sciwheel, they use a
  "reference fragment" (the part of the URL after #) approach to the ref id.
  Unfortunately, it seems reference fragments are not currently supported in 
  the URLFilters that power the declarativeContent API.
  https://stackoverflow.com/questions/25929272/how-to-filter-urls-with-hash-tag-using-urlfilter-in-a-chrome-declarativecont
  https://stackoverflow.com/questions/20855956/how-to-show-chrome-extension-on-certain-domains/20856789#20856789

  So I followed the solution provided in that question that uses the 
  webNavigation API, to listen to events that would change the URL.
  In addition, we also need to listen to events when the tab changes.
  And when those events ocurr, we parse the URL to check if it is a relevant
  page (a specific reference in your Sciwheel) and extract the reference id.
*/

// First listen to events of tab change.
// Want to enable/disable the extension button when tab changes so need to use
// onActivated event, to monitor when tab changes 
// https://developer.chrome.com/extensions/tabs#event-onActivated
chrome.tabs.onActivated.addListener(function(activeInfo) {
  chrome.tabs.get(activeInfo.tabId, function(tab) {
    tab.tabId = tab.id;
    toggleIcon(tab);
  });
});

// And then also listen to navigation events that could change the URL.
// Base filter to check only on sciwheel.com pages
var filter = {
  url: [{
    hostEquals: 'sciwheel.com'
  }]
};
chrome.webNavigation.onCommitted.addListener(toggleIcon, filter);
chrome.webNavigation.onHistoryStateUpdated.addListener(toggleIcon, filter);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(toggleIcon, filter);

function toggleIcon(details) {
  sciwheelRefId = getSciwheelRefId(details.url);
  if (sciwheelRefId) { 
    chrome.pageAction.show(details.tabId);
  } else {
    chrome.pageAction.hide(details.tabId);
  }
}

function getSciwheelRefId(tabUrl) {
  // match the patterns in the URL, in groups for the prefix and refId
  refIdDetailView = tabUrl.match('(sciwheel.com/work/#/items/)(\\d+)');
  refIdUnsortedView = tabUrl.match('(sciwheel.com/work/#/items/unsorted/)(\\d+)');
  refIdPdfView = tabUrl.match('(sciwheel.com/work/item/)(\\d+)');
  // Match any of those formats, or return null -> Nullish coalescing operator
  refId = refIdDetailView ?? refIdPdfView ?? refIdUnsortedView; 
  refId = refId ? refId[2] : refId; // refId are the numbers in the second group
  return refId;
}

// Finally, we also need to listen to click events on our beloved icon
chrome.pageAction.onClicked.addListener(function(activeTab) {

  var sciwheelRefId = getSciwheelRefId(activeTab.url)
  chrome.storage.sync.set({'sciwheelRefId': sciwheelRefId}, function() {
    // TODO: pass the id using local storage or other means (GET params?)
    //       currently using storage.sync because that's the way we store the 
    //       API token (which is good, because the user sets the token once
    //       and forget about it -even in other computer, thx to the sync-)
  });

  var newURL = "annotations_report.html";
  chrome.tabs.create({ url: newURL });

});

