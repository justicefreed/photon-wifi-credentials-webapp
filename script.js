var base_url='http://192.168.0.1/'; // the designated host url for a photon in softAP mode

// this is a wrapper for some parameters that gets used to 
// manage various RSA operations using the Particle device public key. 
// RSA is used to encode the WiFi password for transmission and storage
// to the Photon device
var rsa=new RSAKey();   

// this will hold the Photon device public key
var public_key;

// this will hold the results of the WiFi network scan
var network_list;

// document elements for UI
var scanButton=document.getElementById('scan-button');
var manualButton=document.getElementById('manual-button');
var initialConnectButton=document.getElementById('initial-connect-button');
var connectButton=document.getElementById('connect-button');
var connectFeedback=document.getElementById('connect-feedback');
var copyButton=document.getElementById('copy-button');
var showButton=document.getElementById('show-button');
var deviceID=document.getElementById('device-id');
var connectForm=document.getElementById('connect-form');
var connectDiv = document.getElementById('connect-div');
var scanDiv = document.getElementById('scan-div');
var manualDiv = document.getElementById('manual-div');
var manualForm = document.getElementById('manual-form');
var networksDiv = document.getElementById('networks-div');
var networkInfoDiv = document.getElementById('networks-info-div');
var encryptionRadioDiv = document.getElementById('encryption-radio');
var securityRadioDiv = document.getElementById('security-radio');


const    SECURITY_OPEN           = 0;          /**< Unsecured                               */
const    SECURITY_WEP_PSK        = 1;     	  /**< WEP Security with open authentication   */
const    SECURITY_WEP_SHARED     = 0x8001;     /**< WEP Security with shared authentication */
const    SECURITY_WPA_TKIP_PSK   = 0x00200002; /**< WPA Security with TKIP                  */
const    SECURITY_WPA_AES_PSK    = 0x00200004; /**< WPA Security with AES                   */
const    SECURITY_WPA2_AES_PSK   = 0x00400004; /**< WPA2 Security with AES                  */
const    SECURITY_WPA2_TKIP_PSK  = 0x00400002; /**< WPA2 Security with TKIP                 */
const    SECURITY_WPA2_MIXED_PSK = 0x00400006; /**< WPA2 Security with AES & TKIP           */

// ----------------------------------------------------------------------------------------------------------------
// these wrap get and post requests in the proper format for a Photon to parse.
var getRequest=function(request_url, request_callback){
    var oRequest=new XMLHttpRequest();
    oRequest.open('GET', request_url, true);
    oRequest.timeout=8000;
    oRequest.send();
    oRequest.onreadystatechange=function(){
        if(oRequest.readyState==4)if(request_callback){
            if(oRequest.status==200){
                if(request_callback.success) request_callback.success(JSON.parse(oRequest.responseText));
            }
            else if(request_callback.error) request_callback.error(oRequest.status, oRequest.responseText);
            if(request_callback.regardless) request_callback.regardless();
    }};
};

var postRequest=function(request_url, request_body, request_callback){
    var requestBodyJson=JSON.stringify(request_body);
    var oRequest=new XMLHttpRequest();
    oRequest.open('POST', request_url, true);
    oRequest.timeout=4000;
    oRequest.setRequestHeader('Content-Type', 'multipart/form-data');
    oRequest.send(requestBodyJson);
    oRequest.onreadystatechange=function(){
        if(oRequest.readyState==4)if(request_callback){
            if(oRequest.status==200){
                if(request_callback.success)request_callback.success(JSON.parse(oRequest.responseText));
            }
            else if(request_callback.error)request_callback.error(oRequest.status, oRequest.responseText);
            if(request_callback.regardless)request_callback.regardless();
    }};
};

// ----------------------------------------------------------------------------------------------------------------
// we can use this request to determine if a device is present and reachable aka "connect"
// this is a pre-requisite for being able to send a WiFi password within the WiFi config object
var public_key_callback={
    success:function(a){
        initialConnectButton.innerHTML = 'Connect To Gateway'
        console.log('Public key: '+a.b);
        public_key=a.b;
        rsa.setPublic(public_key.substring(58, 58+256), public_key.substring(318, 318+6));
        initialConnectButton.disabled = false;
        connectFeedback.innerHTML = 'Connection was successful!';
        enableButtons();
        scanDiv.style.display='block';
        manualDiv.style.display='block';
    }, 
    error:function(a, b){
        console.log(a);
        resetPage();
        connectFeedback.innerHTML = '<b>ERROR - Could not connect to Gateway, please retry.</b><br><br>Please make sure Gateway LED is white, and that you are connected to the AMPER-XXX wifi hotspot corresponding to the device.<br><br>  If you are connected to the hotspot, try turning your WiFi off and back on again.';
}};

var getDevicePublicKey = function(){
    console.log("Trying to contact device...");
    resetPage();
    initialConnectButton.innerHTML = '&nbsp&nbsp&nbsp Connecting... &nbsp&nbsp&nbsp';
    initialConnectButton.disabled = true;
    scanDiv.style.display='none';
    networkInfoDiv.style.display='none';
    connectDiv.style.display='none';
    manualDiv.style.display='none';
    networksDiv.innerHTML = '';
    getRequest(base_url+'public-key', public_key_callback);
}


// ----------------------------------------------------------------------------------------------------------------
// This request gets a list of wifi networks and signal strength values
// use this to help select an SSID that is reachable by the device.
// this negates the need to select WiFi network config like encryption type
var scan_callback={
    success:function(a){
        networkInfoDiv.style.display='block';
        network_list=a.scans;
        console.log('I found:');
        networksDiv.innerHTML='<h4>Available Networks</h4>';
        if(network_list.length>0) {
            connectDiv.style.display='block';
            manualForm.style.display='none';
            for(var c=0; c<network_list.length; c++){
                ssid=network_list[c].ssid;
                console.log(network_list[c]);
                add_radio_option(networksDiv, "ssid", ssid);
            }
        }
        else networksDiv.innerHTML='<p class=\'scanning-error\'>No networks found.</p>';
    }, 
    error:function(a){
        console.log('Scanning error:'+a);
        networksDiv.innerHTML='<p class=\'scanning-error\'>Scanning error.</p>';
    }, 
    regardless:function(){
        scanButton.innerHTML='Re-Scan';
        enableButtons();
        networksDiv.style.display='block';
}};

var scan=function(){
    console.log('Scanning...!');
    disableButtons();
    scanButton.innerHTML='Scanning...';
    connectButton.innerHTML='Connect';
    connectDiv.style.display='none';
    manualForm.style.display='none';
    networksDiv.style.display='none';
    getRequest(base_url+'scan-ap', scan_callback);
};

// ----------------------------------------------------------------------------------------------------------------
// This sends over a WiFi configuration object to the photon.  It requires getting the password from
// somewhere, in this case from a document element.
var configure_callback={
    success:function(a){
        console.log('Credentials received.');
        connectButton.innerHTML='Credentials received... Resetting Device';
        reset();
        connectFeedback.innerHTML="New WiFi credentials received.<br><br>The device will reset and attempt to connect.  You should see the Gateway LED turn Green or Yellow within a minute.<br><br>If the LED turns White again, the credentials could not be used to successfully connect and you will need to retry";
        resetPage();
    }, 
    error:function(a, b){
        console.log('Configure error: '+a);
        window.alert('The configuration command failed,  check that you are still well connected to the device\'s WiFi hotspot and retry.');
        connectButton.innerHTML='Retry';
        enableButtons();
}};

var configure=function(a){
    a.preventDefault();
    var request_payload;
    if (manualForm.style.display=='none') {
        var b=get_selected_network();
        if(!b){
            window.alert('Please select a network!');
            return false;
        }
        var sel_pw=document.getElementById('password').value;
        console.log(sel_pw)
        request_payload={idx:0, ssid:b.ssid, pwd:rsa.encrypt(sel_pw), sec:b.sec, ch:b.ch};
    }
    else {
        var sel_ssid=document.getElementById('ssid').value;
        var sel_pw=document.getElementById('password').value;
        var sel_security = getRadioVal(this, 'security');
        sel_security = sel_security ? sel_security : "";
        var sel_encryption = getRadioVal(this, 'encryption');
        sel_encryption = sel_encryption ? sel_encryption : "";
        console.log(sel_security);
        console.log(sel_encryption);
        var sel_sec = convert_selections_to_security(sel_security, sel_encryption);
        console.log(sel_sec);
        if(!sel_ssid || sel_sec == null || (!sel_pw && sel_security != "OPEN")){
            window.alert('Please provide all necessary credentials!');
            return false;
        }
        request_payload={idx:0, ssid:sel_ssid, pwd:rsa.encrypt(sel_pw), sec:sel_sec, ch:0};
    }
    connectButton.innerHTML='Sending credentials...';
    disableButtons();
    console.log('Sending credentials: '+JSON.stringify(request_payload));
    postRequest(base_url+'configure-ap', request_payload, configure_callback);
};


var handle_manual_button=function(){
    scanDiv.style.display = 'block';
    connectDiv.style.display = 'block';
    manualForm.style.display = 'block';
    networksDiv.style.display = 'none';
    scanButton.innerHTML='Scan';
    networkInfoDiv.style.display='none'
    securityRadioDiv.innerHTML = '<p>Security Type</p>';
    add_radio_option(securityRadioDiv, "security", "OPEN");
    add_radio_option(securityRadioDiv, "security", "WEP");
    add_radio_option(securityRadioDiv, "security", "WPA");
    add_radio_option(securityRadioDiv, "security", "WPA2");
}

// ----------------------------------------------------------------------------------------------------------------
// this calls a special function to reset the device, which will subsequently attempt a connection
var reset_callback={
    success:function(a){
        console.log("reset request succeeded");
    }, 
    error:function(a, b){
        console.log("reset request timed out or had an error");
    }
};

var reset = function(){
    console.log("Resetting device");
    getRequest(base_url+'reset', {}, reset_callback);   // won't call callback ever, just will reset
};

// ----------------------------------------------------------------------------------------------------------------
// these are functions for the DOM control
var disableButtons=function(){
    connectButton.disabled=true;
    scanButton.disabled=true;
};

var enableButtons=function(){
    connectButton.disabled=false;
    scanButton.disabled=false;
};

var add_radio_option=function(wrapper_div, type_name, element_name){
    var input_element=document.createElement('INPUT');
    input_element.type='radio';
    input_element.value=element_name;
    input_element.id=element_name;
    input_element.name=type_name;
    input_element.className='radio';
    var radio_div=document.createElement('DIV');
    radio_div.className='radio-div';
    radio_div.appendChild(input_element);
    var label_element=document.createElement('label');
    label_element.htmlFor=element_name;
    label_element.innerHTML=element_name;
    radio_div.appendChild(label_element);
    wrapper_div.appendChild(radio_div);
};


var get_selected_network=function(){
    for(var a=0; a<network_list.length; a++){
    ssid=network_list[a].ssid;
    if(document.getElementById(ssid).checked) return network_list[a];
}};

var get_encryption_options_from_security=function(security){
    if (security == "OPEN") return [];
    else if (security == "WEP") return ["PSK", "SHARED"];
    else if (security == "WPA") return ["TKIP", "AES"];
    else return ["TKIP", "AES", "AES/TKIP"];
}

var convert_security_to_selections=function(sec_val) {
    switch(sec_val) {
        case SECURITY_OPEN: {
            return ("OPEN", "");
        }
        case SECURITY_WEP_PSK: {
            return ("WEP", "PSK");
        }
        case SECURITY_WEP_SHARED: {
            return ("WEP", "SHARED");
        }
        case SECURITY_WPA_TKIP_PSK: {
            return ("WPA", "TKIP");
        }
        case SECURITY_WPA_AES_PSK: {
            return ("WPA", "AES");
        }
        case SECURITY_WPA2_TKIP_PSK: {
            return ("WPA2", "TKIP");
        }
        case SECURITY_WPA2_AES_PSK: {
            return ("WPA2", "AES");
        }
        case SECURITY_WPA2_MIXED_PSK: {
            return ("WPA2", "AES/TKIP");
        }
        default: {
            return null;
        }
    }
}

var convert_selections_to_security=function(security, encryption) {
    if (security == "OPEN") return SECURITY_OPEN;
    else if (security == "WEP") {
        if (encryption == "PSK") return SECURITY_WEP_PSK;
        else if (encryption == "SHARED") return SECURITY_WEP_SHARED;
    }
    else if (security == "WPA") {
        if (encryption == "TKIP") return SECURITY_WPA_TKIP_PSK;
        else if (encryption == "AES") return SECURITY_WPA_AES_PSK;
    }
    else {
        if (encryption == "TKIP") return SECURITY_WPA2_TKIP_PSK;
        else if (encryption == "AES") return SECURITY_WPA2_AES_PSK;
        else if (encryption == "AES/TKIP") return SECURITY_WPA2_MIXED_PSK;
    }
    return null;
}

var update_encryption_options=function(){
    if (document.getElementById("OPEN").checked) {
        encryptionRadioDiv.innerHTML = '';
    }
    else {
        encryptionRadioDiv.innerHTML = '<p>Encryption Type</p>';
        if (document.getElementById("WEP").checked) {
            var selections = get_encryption_options_from_security("WEP");
            for (var i = 0; i < selections.length; i++) {
                add_radio_option(encryptionRadioDiv, "encryption", selections[i]);
            }
        }
        else if (document.getElementById("WPA").checked) {
            var selections = get_encryption_options_from_security("WPA");
            for (var i = 0; i < selections.length; i++) {
                add_radio_option(encryptionRadioDiv, "encryption", selections[i]);
            }
        }
        else if (document.getElementById("WPA2").checked) {
            var selections = get_encryption_options_from_security("WPA2");
            for (var i = 0; i < selections.length; i++) {
                add_radio_option(encryptionRadioDiv, "encryption", selections[i]);
            }
        }
    }
}

function getRadioVal(form, name) {
    var val;
    // get list of radio buttons with specified name
    var radios = form.elements[name];
    
    if (!radios) return null;
    // loop through list of radio buttons
    for (var i=0, len=radios.length; i<len; i++) {
        if ( radios[i].checked ) { // radio checked?
            val = radios[i].value; // if so, hold its value in val
            break; // and break out of for loop
        }
    }
    return val; // return value of checked radio or undefined if none checked
}

var toggleShow=function(){
    var a=document.getElementById('password');
    inputType=a.type;
    if(inputType==='password'){
        showButton.innerHTML='Hide';
        a.type='text';
    }
    else{
        showButton.innerHTML='Show';
        a.type='password';
}};

var resetPage = function(){
    rsa=new RSAKey();
    public_key = "";
    scanButton.innerHTML='Scan';
    networkInfoDiv.style.display='none'
    initialConnectButton.innerHTML = 'Connect To Gateway'
    initialConnectButton.disabled = false;
    scanDiv.style.display='none';
    manualDiv.style.display='none';
    connectDiv.style.display='none';
    networksDiv.innerHTML = '';
    enableButtons();
}

// ----------------------------------------------------------------------------------------------------------------
// event listeners
if(scanButton.addEventListener){
    initialConnectButton.addEventListener('click',  getDevicePublicKey);
    showButton.addEventListener('click', toggleShow);
    scanButton.addEventListener('click', scan);
    manualButton.addEventListener('click', handle_manual_button);
    securityRadioDiv.addEventListener('click', update_encryption_options);
    connectForm.addEventListener('submit', configure);
    
}
else if(scanButton.attachEvent){
    initialConnectButton.attachEvent('onclick',  getDevicePublicKey);
    showButton.attachEvent('onclick', toggleShow);
    scanButton.attachEvent('onclick', scan);
    manualButton.addEvent('onclick', handle_manual_button);
    securityRadioDiv.addEvent('onclick', update_encryption_options);
    connectForm.attachEvent('onsubmit', configure);
}


// // ----------------------------------------------------------------------------------------------------------------
// // unused request to get device id from photon
// var device_id_callback={
//     success:function(a){
//         var b=a.id;
//         deviceID.value=b;
//     }, 
//     error:function(a, b){
//     console.log(a);
//     var c='COMMUNICATION_ERROR';
//     deviceID.value=c;
// }};
// getRequest(base_url+'device-id', device_id_callback);
