// 
function onWebNav(details) {
  var refIndex = details.url.indexOf('#');
  var ref = refIndex >= 0 ? details.url.slice(refIndex + 1) : '';
  if ( (ref.indexOf('/items/') != -1 && ref.match('/\\d+') != null) || details.url.match('/work/item/\\d+') != null) { 
    chrome.pageAction.show(details.tabId);
  } else {
    chrome.pageAction.hide(details.tabId);
  }
}s

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
  
  // https://sciwheel.com/work/#/items/5821872?target=notes
  // https://sciwheel.com/work/item/5821872/resources/4639906/pdf

  // We match any number, and then we will get first the 1000 from sciwheel.com 
  // and the second number in the array must be the article id
  var regex = /[0-9]+/g;
  var urlNumbers = activeTab.url.match(regex);
  var sciwheelRefId = urlNumbers[1];

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

