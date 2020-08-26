const TOKEN_KEY = ''

function save_options() {

    var sciwheelAuthToken = document.getElementById('sciwheelAuthToken').value;
  
    chrome.storage.sync.set({'sciwheelAuthToken': sciwheelAuthToken}, function() {
      // Notify that we saved.
      var status = document.getElementById('status');
      status.textContent = `Token saved! You're good to go and should not 
                            have to do this again`;
      setTimeout(function() {status.textContent = '';}, 2500);
   });
}

function delete_options() {

    chrome.storage.sync.remove('sciwheelAuthToken', () => {
        var status = document.getElementById('status_delete');
        status.textContent = 'Token deleted!';
        setTimeout(function() {status.textContent = '';}, 2500);
        restore_options();
    });

}

// Restores the token stored in chrome.storage.sync
function restore_options() {
    chrome.storage.sync.get(['sciwheelAuthToken'], function(result) {
        var sciwheelAuthToken = result.sciwheelAuthToken;
        // Test for non-falsy val. If not token had been set, it'd be undefined
        // Other approach would be asking for the key with default value
        // https://stackoverflow.com/questions/29399293/checking-whether-data-already-exists-in-chrome-storage-sync
        if (sciwheelAuthToken) {
            document.getElementById('sciwheelAuthToken').value = sciwheelAuthToken;
            document.getElementById('delete_btn').style.display = "block";
            var status = document.getElementById('status_delete');
            status.textContent = `
                You have already saved a token (shown above).
                You can update the token if needed (e.g. if you generated a 
                new token in your Sciwheel account, which invalidates all 
                previous tokens).
                Or you can delete the token if you want to remove this 
                information from your account.
            `;                                 
        } else {
            document.getElementById('sciwheelAuthToken').value = '';
            document.getElementById('delete_btn').style.display = "none";
        }
        //document.getElementById('sciwheelAuthToken').value = sciwheelAuthToken;
    });  
}
document.addEventListener('DOMContentLoaded', restore_options);
document.getElementById('save_btn').addEventListener('click', save_options);
document.getElementById('delete_btn').addEventListener('click', delete_options);
