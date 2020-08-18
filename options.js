// Saves options to chrome.storage
function save_options() {

    var sciwheelAuthToken = document.getElementById('sciwheelAuthToken').value;
  
    chrome.storage.sync.set({'sciwheelAuthToken': sciwheelAuthToken}, function() {
      // Notify that we saved.
      var status = document.getElementById('status');
      status.textContent = 'Token saved!';
      setTimeout(function() {status.textContent = '';}, 750);
   });
}
  
// Restores the token stored in chrome.storage.sync
function restore_options() {
chrome.storage.sync.get(['sciwheelAuthToken'], function(result) {
    var sciwheelAuthToken = result.sciwheelAuthToken;
    document.getElementById('sciwheelAuthToken').value = sciwheelAuthToken;
});  
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save').addEventListener('click', save_options);